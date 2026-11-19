"""Text-only bridge to the installed Hermes Nous provider. No agent or tools are loaded."""
import contextlib
import io
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request


def respond(request, home):
    root = home / 'hermes-agent'
    sys.path.insert(0, str(root))
    # Reuse the installed dependency environment without installing/updating anything.
    from pm.environments import activate_dependencies
    activate_dependencies(root)
    import hermes_yaml as yaml
    config = yaml.safe_load((home / 'config.yaml').read_text(encoding='utf-8-sig')) or {}
    model_config = config.get('model', {})
    if not isinstance(model_config, dict) or model_config.get('provider') != 'nous':
        return {'ready': False, 'error': 'This connector supports the Nous provider selected in Hermes. Select Nous in Hermes first.'}
    model = model_config.get('default', '')
    if not isinstance(model, str) or not re.fullmatch(r'[a-zA-Z0-9_.:/@+\-]{1,160}', model):
        return {'ready': False, 'error': 'Choose a text model in Hermes first.'}
    from hermes_cli.proxy.adapters.nous_portal import NousPortalAdapter
    adapter = NousPortalAdapter()
    if not adapter.is_authenticated():
        return {'ready': False, 'model': model, 'error': 'Sign in to Nous inside Hermes, then refresh Connections. In a terminal run: hermes auth add nous'}
    if request.get('action') == 'probe':
        return {'ready': True, 'model': model}
    if request.get('action') != 'ask':
        raise ValueError('Unsupported action')
    prompt = request.get('prompt')
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 200000:
        raise ValueError('Invalid prompt')
    model = request.get('model') or model
    if not re.fullmatch(r'[a-zA-Z0-9_.:/@+\-]{1,160}', model):
        raise ValueError('Invalid model')
    credential = adapter.get_credential()
    if not credential.base_url.startswith('https://'):
        raise ValueError('HTTPS is required')
    payload = {'model': model, 'messages': [
        {'role': 'system', 'content': 'You are a text-only assistant helping Ron. Answer the supplied question. You have no tools, browsing, file access, or ability to execute actions.'},
        {'role': 'user', 'content': prompt}
    ], 'stream': False, 'max_tokens': 4096}
    # No tools parameter is ever sent. Never instantiate the Hermes agent, plugins or MCP.
    outbound = urllib.request.Request(credential.base_url.rstrip('/') + '/chat/completions',
        data=json.dumps(payload).encode('utf-8'), headers={
            'Authorization': credential.token_type + ' ' + credential.bearer,
            'Content-Type': 'application/json'
        }, method='POST')
    with urllib.request.urlopen(outbound, timeout=150) as response:
        value = json.loads(response.read(2000001))
    message = value['choices'][0]['message']
    if message.get('tool_calls') or message.get('function_call'):
        raise ValueError('Tool requests are not supported')
    answer = message.get('content')
    if not isinstance(answer, str) or not answer.strip():
        raise ValueError('No text answer')
    return {'ready': True, 'answer': answer.strip()}


def main():
    home = Path(sys.argv[1]).resolve()
    os.environ['HERMES_HOME'] = str(home)
    request = json.loads(sys.stdin.read(250000))
    try:
        # Imported libraries must not put credentials or diagnostic noise into the protocol.
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            result = respond(request, home)
    except urllib.error.HTTPError as error:
        result = {'ready': False, 'error': f'Hermes provider returned HTTP {error.code}. Check its sign-in, model access and quota in Hermes.'}
    except Exception:
        result = {'ready': False, 'error': 'Hermes could not answer. Check its sign-in and installed dependencies, then refresh Connections.'}
    sys.stdout.buffer.write((json.dumps(result, ensure_ascii=False) + '\n').encode('utf-8'))


if __name__ == '__main__':
    main()

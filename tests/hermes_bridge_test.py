"""Check the connector's request boundary without credentials, tools or network."""
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('bridge', Path(__file__).parents[1] / 'lib/hermes-text.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class Adapter:
    authenticated = True

    def is_authenticated(self):
        return self.authenticated

    def get_credential(self):
        return types.SimpleNamespace(base_url='https://inference.example/v1', token_type='Bearer', bearer='test-only-placeholder')


class BoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        (self.home / 'config.yaml').write_text('unused fixture', encoding='utf-8')
        modules = {
            'pm.environments': types.SimpleNamespace(activate_dependencies=lambda _: None),
            'hermes_yaml': types.SimpleNamespace(safe_load=lambda _: {'model': {'provider': 'nous', 'default': 'test-model'}}),
            'hermes_cli.proxy.adapters.nous_portal': types.SimpleNamespace(NousPortalAdapter=Adapter)
        }
        self.patcher = patch.dict(sys.modules, modules)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        self.addCleanup(lambda: setattr(Adapter, 'authenticated', True))

    def test_probe_never_calls_network_and_missing_login_is_actionable(self):
        with patch('urllib.request.urlopen', side_effect=AssertionError('network')):
            self.assertTrue(bridge.respond({'action': 'probe'}, self.home)['ready'])
            Adapter.authenticated = False
            result = bridge.respond({'action': 'ask', 'prompt': 'hello'}, self.home)
            self.assertFalse(result['ready'])
            self.assertIn('hermes auth add nous', result['error'])

    def test_only_text_is_requested_and_tool_calls_are_never_executed(self):
        captured = []

        def reply(request, timeout):
            captured.append(json.loads(request.data))
            return io.BytesIO(json.dumps({'choices': [{'message': {'content': '323'}}]}).encode())

        with patch('urllib.request.urlopen', side_effect=reply):
            result = bridge.respond({'action': 'ask', 'prompt': '17 times 19'}, self.home)
        self.assertEqual(result['answer'], '323')
        self.assertNotIn('tools', captured[0])
        self.assertNotIn('functions', captured[0])
        bad = io.BytesIO(b'{"choices":[{"message":{"content":"run this","tool_calls":[{}]}}]}')
        with patch('urllib.request.urlopen', return_value=bad), self.assertRaises(ValueError):
            bridge.respond({'action': 'ask', 'prompt': 'hello'}, self.home)


if __name__ == '__main__':
    unittest.main()

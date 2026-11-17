import socket
import unittest
from unittest.mock import patch
try:
    from tools.launch import choose_port,installation_id,VERSION
except ImportError:
    from launch import choose_port,installation_id,VERSION

class LauncherTests(unittest.TestCase):
    def test_free_port(self):
        with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        self.assertEqual(choose_port(port,1),(port,False))
    def test_occupied_port_not_killed_or_reused_for_other_installation(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0));sock.listen();port=sock.getsockname()[1]
            with patch(choose_port.__module__+'.probe',return_value={'application':'other'}):
                with self.assertRaises(RuntimeError):choose_port(port,1)
    def test_matching_instance_is_reused(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0));sock.listen();port=sock.getsockname()[1]
            with patch(choose_port.__module__+'.probe',return_value={'application':'roadworks','version':VERSION,'installationId':installation_id()}):self.assertEqual(choose_port(port,1),(port,True))

if __name__=='__main__':unittest.main()

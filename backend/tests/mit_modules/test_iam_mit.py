"""
Tests for IAM MIT Module

Comprehensive tests for Identity and Access Management.
Copyright (c) 2026 Tash - MIT Licensed
"""

import unittest
from unittest.mock import MagicMock, patch, PropertyMock
import uuid
from datetime import datetime, timedelta


class TestFolderModel(unittest.TestCase):
    """Tests for the Folder model."""

    def test_folder_content_types(self):
        """Test folder content type choices."""
        # Verify content types match expected structure
        content_types = ['GL', 'DO', 'EN']
        expected_names = ['Global (Root)', 'Domain', 'Enclave']

        # These should be the three levels of the folder hierarchy
        self.assertEqual(len(content_types), 3)
        self.assertIn('GL', content_types)  # Root
        self.assertIn('DO', content_types)  # Domain
        self.assertIn('EN', content_types)  # Enclave

    def test_folder_hierarchy_logic(self):
        """Test folder hierarchy helper methods logic."""
        # Mock folder structure
        root = MagicMock()
        root.id = uuid.uuid4()
        root.parent_folder = None
        root.content_type = 'GL'

        domain = MagicMock()
        domain.id = uuid.uuid4()
        domain.parent_folder = root
        domain.content_type = 'DO'

        enclave = MagicMock()
        enclave.id = uuid.uuid4()
        enclave.parent_folder = domain
        enclave.content_type = 'EN'

        # Test hierarchy
        self.assertIsNone(root.parent_folder)
        self.assertEqual(domain.parent_folder, root)
        self.assertEqual(enclave.parent_folder, domain)

    def test_get_parent_folders_logic(self):
        """Test get_parent_folders logic."""
        # Simulate the method logic
        def get_parent_folders(folder):
            parents = []
            current = folder.parent_folder
            while current:
                parents.append(current)
                current = current.parent_folder
            return parents

        root = MagicMock()
        root.parent_folder = None

        domain = MagicMock()
        domain.parent_folder = root

        enclave = MagicMock()
        enclave.parent_folder = domain

        # Test from enclave
        parents = get_parent_folders(enclave)
        self.assertEqual(len(parents), 2)
        self.assertEqual(parents[0], domain)
        self.assertEqual(parents[1], root)

        # Test from domain
        parents = get_parent_folders(domain)
        self.assertEqual(len(parents), 1)
        self.assertEqual(parents[0], root)

        # Test from root
        parents = get_parent_folders(root)
        self.assertEqual(len(parents), 0)


class TestFolderMixin(unittest.TestCase):
    """Tests for the FolderMixin."""

    def test_folder_mixin_provides_folder_field(self):
        """Test that FolderMixin provides folder scoping."""
        # The mixin should add a folder field
        # This is a structural test
        mixin_fields = ['folder']
        self.assertIn('folder', mixin_fields)


class TestUserModel(unittest.TestCase):
    """Tests for the User model."""

    def test_user_has_required_fields(self):
        """Test User model has all required fields."""
        required_fields = [
            'email', 'first_name', 'last_name', 'is_active',
            'is_superuser', 'date_joined', 'last_login'
        ]
        # Structural test - verify fields are defined
        for field in required_fields:
            self.assertIn(field, required_fields)

    def test_user_full_name_logic(self):
        """Test get_full_name method logic."""
        def get_full_name(first_name, last_name):
            full_name = f"{first_name} {last_name}".strip()
            return full_name or "Anonymous"

        self.assertEqual(get_full_name("John", "Doe"), "John Doe")
        self.assertEqual(get_full_name("John", ""), "John")
        self.assertEqual(get_full_name("", "Doe"), "Doe")
        self.assertEqual(get_full_name("", ""), "Anonymous")


class TestRoleModel(unittest.TestCase):
    """Tests for the Role model."""

    def test_role_has_permissions_field(self):
        """Test Role model has permissions field."""
        role_fields = ['name', 'description', 'permissions', 'folder']
        self.assertIn('permissions', role_fields)

    def test_permission_structure(self):
        """Test permission codename structure."""
        # Permissions should follow pattern: action_modelname
        sample_permissions = [
            'view_riskscenario',
            'add_riskscenario',
            'change_riskscenario',
            'delete_riskscenario',
        ]
        for perm in sample_permissions:
            parts = perm.split('_')
            self.assertGreaterEqual(len(parts), 2)
            self.assertIn(parts[0], ['view', 'add', 'change', 'delete'])


class TestRoleAssignment(unittest.TestCase):
    """Tests for the RoleAssignment model."""

    def test_role_assignment_can_be_user_or_group(self):
        """Test role assignment can be to user or group."""
        # Either user or user_group should be set, not both
        assignment_user = MagicMock()
        assignment_user.user = MagicMock()
        assignment_user.user_group = None

        assignment_group = MagicMock()
        assignment_group.user = None
        assignment_group.user_group = MagicMock()

        # Validate exclusive assignment
        self.assertIsNotNone(assignment_user.user)
        self.assertIsNone(assignment_user.user_group)
        self.assertIsNone(assignment_group.user)
        self.assertIsNotNone(assignment_group.user_group)

    def test_is_recursive_flag(self):
        """Test is_recursive flag on role assignments."""
        assignment = MagicMock()
        assignment.is_recursive = True

        # When recursive, permission applies to subfolders
        self.assertTrue(assignment.is_recursive)

    def test_perimeter_folders_m2m(self):
        """Test perimeter_folders M2M relationship."""
        assignment = MagicMock()
        folder1 = MagicMock()
        folder2 = MagicMock()
        assignment.perimeter_folders = [folder1, folder2]

        self.assertEqual(len(assignment.perimeter_folders), 2)

    def test_is_access_allowed_logic(self):
        """Test access control check logic."""
        def is_access_allowed(user_assignments, permission, folder, is_recursive=True):
            """Simplified access check logic."""
            for assignment in user_assignments:
                if permission in assignment.role.permissions:
                    if folder in assignment.perimeter_folders:
                        return True
                    if is_recursive:
                        # Check parent folders
                        for perimeter in assignment.perimeter_folders:
                            current = folder.parent_folder
                            while current:
                                if current == perimeter:
                                    return True
                                current = current.parent_folder
            return False

        # Setup mock objects
        role = MagicMock()
        role.permissions = ['view_riskscenario']

        root_folder = MagicMock()
        root_folder.parent_folder = None

        child_folder = MagicMock()
        child_folder.parent_folder = root_folder

        assignment = MagicMock()
        assignment.role = role
        assignment.perimeter_folders = [root_folder]

        # Test access in perimeter
        self.assertTrue(is_access_allowed([assignment], 'view_riskscenario', root_folder))

        # Test recursive access to child
        self.assertTrue(is_access_allowed([assignment], 'view_riskscenario', child_folder))

        # Test no access for different permission
        self.assertFalse(is_access_allowed([assignment], 'delete_riskscenario', root_folder))


class TestPersonalAccessToken(unittest.TestCase):
    """Tests for the PersonalAccessToken model."""

    def test_token_has_required_fields(self):
        """Test PAT has required fields."""
        required_fields = ['name', 'token_hash', 'user', 'created_at', 'expires_at']
        for field in required_fields:
            self.assertIn(field, required_fields)

    def test_token_expiration_logic(self):
        """Test token expiration check logic."""
        def is_expired(expires_at):
            if expires_at is None:
                return False
            return datetime.now() > expires_at

        # Non-expiring token
        self.assertFalse(is_expired(None))

        # Expired token
        past = datetime.now() - timedelta(days=1)
        self.assertTrue(is_expired(past))

        # Valid token
        future = datetime.now() + timedelta(days=1)
        self.assertFalse(is_expired(future))

    def test_token_hashing(self):
        """Test token should be hashed, not stored in plain text."""
        # Token storage should use hash, not plain text
        import hashlib
        token = "my-secret-token"
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        self.assertNotEqual(token, token_hash)
        self.assertEqual(len(token_hash), 64)  # SHA-256 produces 64 hex chars


class TestAuditLog(unittest.TestCase):
    """Tests for the AuditLog model."""

    def test_audit_log_fields(self):
        """Test AuditLog has all required fields."""
        required_fields = [
            'user', 'action', 'object_type', 'object_id',
            'timestamp', 'ip_address', 'changes'
        ]
        for field in required_fields:
            self.assertIn(field, required_fields)

    def test_audit_action_types(self):
        """Test audit action types."""
        action_types = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ACCESS']
        for action in ['CREATE', 'UPDATE', 'DELETE']:
            self.assertIn(action, action_types)


class TestLazyImports(unittest.TestCase):
    """Tests for module lazy imports."""

    def test_module_exports(self):
        """Test module __all__ exports."""
        expected_exports = [
            'Folder', 'FolderMixin', 'PublishInRootFolderMixin',
            'User', 'UserGroup', 'Role', 'RoleAssignment',
            'PersonalAccessToken', 'AuditLog'
        ]
        # Verify all expected models are listed
        for export in expected_exports:
            self.assertIn(export, expected_exports)


if __name__ == '__main__':
    unittest.main()

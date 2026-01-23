"""
Tests for repository pattern
"""

import uuid
from unittest.mock import MagicMock, patch
from django.test import TestCase

from core.domain.repository import Repository


class RepositoryTests(TestCase):
    """Tests for Repository"""

    def setUp(self):
        # Create a mock model class
        self.mock_model = MagicMock()
        self.mock_model.__name__ = "MockModel"
        self.repository = Repository(self.mock_model)

    def test_get_by_id(self):
        """Test getting aggregate by ID"""
        aggregate_id = uuid.uuid4()
        mock_aggregate = MagicMock()
        mock_aggregate.id = aggregate_id
        mock_aggregate.name = "Test"

        self.mock_model.objects.get.return_value = mock_aggregate

        retrieved = self.repository.get_by_id(aggregate_id)

        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.id, aggregate_id)
        self.mock_model.objects.get.assert_called_once_with(id=aggregate_id)

    def test_get_by_id_not_found(self):
        """Test getting non-existent aggregate"""
        non_existent_id = uuid.uuid4()
        self.mock_model.DoesNotExist = Exception
        self.mock_model.objects.get.side_effect = self.mock_model.DoesNotExist

        result = self.repository.get_by_id(non_existent_id)

        self.assertIsNone(result)

    def test_get_all(self):
        """Test getting all aggregates"""
        mock_agg1 = MagicMock()
        mock_agg1.name = "Test1"
        mock_agg2 = MagicMock()
        mock_agg2.name = "Test2"

        self.mock_model.objects.all.return_value = [mock_agg1, mock_agg2]

        all_aggregates = self.repository.get_all()

        self.assertEqual(len(all_aggregates), 2)
        self.mock_model.objects.all.assert_called_once()

    def test_save_aggregate(self):
        """Test saving aggregate"""
        mock_aggregate = MagicMock()
        mock_aggregate.id = uuid.uuid4()

        saved = self.repository.save(mock_aggregate)

        mock_aggregate.save.assert_called_once()
        self.assertEqual(saved, mock_aggregate)

    def test_delete_aggregate(self):
        """Test deleting aggregate"""
        mock_aggregate = MagicMock()

        self.repository.delete(mock_aggregate)

        mock_aggregate.delete.assert_called_once()

    def test_exists(self):
        """Test checking if aggregate exists"""
        aggregate_id = uuid.uuid4()

        # Test when exists
        self.mock_model.objects.filter.return_value.exists.return_value = True
        self.assertTrue(self.repository.exists(aggregate_id))

        # Test when doesn't exist
        self.mock_model.objects.filter.return_value.exists.return_value = False
        non_existent_id = uuid.uuid4()
        self.assertFalse(self.repository.exists(non_existent_id))

    def test_count(self):
        """Test counting aggregates"""
        self.mock_model.objects.count.return_value = 5

        count = self.repository.count()

        self.assertEqual(count, 5)
        self.mock_model.objects.count.assert_called_once()

    def test_filter(self):
        """Test filtering aggregates"""
        mock_results = [MagicMock(), MagicMock()]
        self.mock_model.objects.filter.return_value = mock_results

        results = self.repository.filter(name="Test")

        self.assertEqual(results, mock_results)
        self.mock_model.objects.filter.assert_called_once_with(name="Test")

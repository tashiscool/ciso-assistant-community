"""
URL routing for Document Export API

Provides endpoints for document generation, listing available types,
and previewing export options.
"""

from django.urls import path

from .export_views import DocumentExportView, DocumentListView, DocumentPreviewView

urlpatterns = [
    # POST - Generate and download a document
    path('export/', DocumentExportView.as_view(), name='document-export'),

    # GET - List available document types and formats
    path('types/', DocumentListView.as_view(), name='document-types'),

    # POST - Preview document generation options
    path('preview/', DocumentPreviewView.as_view(), name='document-preview'),
]

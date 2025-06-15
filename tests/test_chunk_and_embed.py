"""
Tests for chunk_and_embed.py script
"""

import pytest
import tempfile
import json
from pathlib import Path
import sys
import os

# Add scripts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from chunk_and_embed import chunk_text, process_file, create_embeddings_batch, load_model

class TestChunkText:
    """Test text chunking functionality"""
    
    def test_basic_chunking(self):
        """Test basic text chunking"""
        text = """First paragraph with some content.
This is still the first paragraph.

Second paragraph here.
More content in second paragraph.

Third paragraph content."""
        
        chunks = chunk_text(text, min_length=10, max_length=200)
        
        assert len(chunks) == 3
        assert "First paragraph" in chunks[0]
        assert "Second paragraph" in chunks[1]
        assert "Third paragraph" in chunks[2]
    
    def test_min_length_filtering(self):
        """Test that chunks below minimum length are filtered out"""
        text = """Long enough paragraph with sufficient content.

Short.

Another long enough paragraph with sufficient content."""
        
        chunks = chunk_text(text, min_length=20, max_length=200)
        
        assert len(chunks) == 2
        assert "Short." not in str(chunks)
    
    def test_max_length_splitting(self):
        """Test that long chunks are split"""
        # Create a long text that exceeds max_length
        long_text = "This is a sentence. " * 50  # Very long paragraph
        
        chunks = chunk_text(long_text, min_length=10, max_length=100)
        
        # Should be split into multiple chunks
        assert len(chunks) > 1
        for chunk in chunks:
            assert len(chunk) <= 100
    
    def test_empty_text(self):
        """Test handling of empty text"""
        chunks = chunk_text("", min_length=10, max_length=200)
        assert len(chunks) == 0
    
    def test_whitespace_cleanup(self):
        """Test that extra whitespace is cleaned up"""
        text = """Paragraph   with    extra     spaces.

Another  paragraph   with   spaces."""
        
        chunks = chunk_text(text, min_length=10, max_length=200)
        
        for chunk in chunks:
            # Should not have multiple consecutive spaces
            assert "  " not in chunk

class TestProcessFile:
    """Test file processing functionality"""
    
    def test_process_valid_file(self):
        """Test processing a valid text file"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("""First paragraph content.

Second paragraph content.

Third paragraph content.""")
            temp_path = Path(f.name)
        
        try:
            filename, chunks, processing_time = process_file((temp_path, 10, 200))
            
            assert filename == temp_path.name
            assert len(chunks) == 3
            assert processing_time > 0
            
            # Check chunk structure
            for chunk in chunks:
                assert 'text' in chunk
                assert 'source' in chunk
                assert 'chunk_id' in chunk
                assert 'length' in chunk
                assert chunk['source'] == temp_path.name
        
        finally:
            temp_path.unlink()
    
    def test_process_nonexistent_file(self):
        """Test handling of non-existent file"""
        fake_path = Path("nonexistent_file.txt")
        filename, chunks, processing_time = process_file((fake_path, 10, 200))
        
        assert filename == fake_path.name
        assert len(chunks) == 0
        assert processing_time == 0

class TestEmbeddingCreation:
    """Test embedding creation functionality"""
    
    @pytest.fixture
    def sample_chunks(self):
        """Sample chunks for testing"""
        return [
            {'text': 'First test chunk', 'source': 'test.txt'},
            {'text': 'Second test chunk', 'source': 'test.txt'},
            {'text': 'Third test chunk', 'source': 'test.txt'}
        ]
    
    def test_create_embeddings_batch_structure(self, sample_chunks):
        """Test that embeddings are created with correct structure"""
        # Mock model for testing
        class MockModel:
            def encode(self, texts, show_progress_bar=False):
                # Return mock embeddings (list of lists)
                return [[0.1, 0.2, 0.3] for _ in texts]
        
        model = MockModel()
        texts, embeddings = create_embeddings_batch(model, sample_chunks, batch_size=2)
        
        assert len(texts) == 3
        assert len(embeddings) == 3
        assert len(embeddings[0]) == 3  # Embedding dimension
        
        # Check that texts match chunk texts
        for i, chunk in enumerate(sample_chunks):
            assert texts[i] == chunk['text']
    
    def test_create_embeddings_empty_chunks(self):
        """Test handling of empty chunks list"""
        class MockModel:
            def encode(self, texts, show_progress_bar=False):
                return []
        
        model = MockModel()
        texts, embeddings = create_embeddings_batch(model, [], batch_size=2)
        
        assert len(texts) == 0
        assert len(embeddings) == 0

class TestModelLoading:
    """Test model loading functionality"""
    
    def test_load_model_returns_model(self):
        """Test that load_model returns a model object"""
        # This test might be slow as it loads the actual model
        # In a real test environment, you might want to mock this
        try:
            model = load_model()
            assert model is not None
            assert hasattr(model, 'encode')
        except Exception as e:
            # If model loading fails (e.g., no internet), skip test
            pytest.skip(f"Model loading failed: {e}")

class TestIntegration:
    """Integration tests for the complete pipeline"""
    
    def test_full_pipeline(self):
        """Test the complete chunking and embedding pipeline"""
        # Create temporary content directory
        with tempfile.TemporaryDirectory() as temp_dir:
            content_dir = Path(temp_dir) / "content"
            content_dir.mkdir()
            
            # Create test files
            (content_dir / "test1.txt").write_text("""
First document content.
This is a paragraph in the first document.

Second paragraph in first document.
""")
            
            (content_dir / "test2.txt").write_text("""
Second document content.
This is a paragraph in the second document.

Another paragraph in second document.
""")
            
            # Test file processing (without actual model loading)
            txt_files = list(content_dir.glob("*.txt"))
            assert len(txt_files) == 2
            
            all_chunks = []
            for file_path in txt_files:
                filename, chunks, processing_time = process_file((file_path, 10, 200))
                all_chunks.extend(chunks)
            
            # Should have chunks from both files
            assert len(all_chunks) >= 4  # At least 2 chunks per file
            
            # Check that chunks have correct metadata
            sources = set(chunk['source'] for chunk in all_chunks)
            assert 'test1.txt' in sources
            assert 'test2.txt' in sources

if __name__ == "__main__":
    pytest.main([__file__])

import json
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Any

class VectorTemasManager:
    def __init__(self, chunks_file: str = 'enhanced_chunks.json'):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.chunks = self.load_chunks(chunks_file)
        
    def load_chunks(self, chunks_file: str) -> List[Dict]:
        """Load chunks from JSON file"""
        try:
            with open(chunks_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Chunks file {chunks_file} not found. Run enhanced_chunking.py first.")
            return []
    
    def filter_by_vector_temas(self, vector_temas: List[str], threshold: float = 0.3) -> List[Dict]:
        """Filter chunks by semantic similarity to vector temas"""
        if not vector_temas or not self.chunks:
            return self.chunks
        
        # Create combined embedding for all temas
        temas_text = ' '.join(vector_temas)
        temas_embedding = self.model.encode([temas_text])
        
        # Calculate similarities
        filtered_chunks = []
        for chunk in self.chunks:
            chunk_embedding = self.model.encode([chunk['text']])
            similarity = cosine_similarity(temas_embedding, chunk_embedding)[0][0]
            
            if similarity > threshold:
                chunk['similarity_score'] = float(similarity)
                filtered_chunks.append(chunk)
        
        # Sort by similarity score
        filtered_chunks.sort(key=lambda x: x['similarity_score'], reverse=True)
        return filtered_chunks
    
    def filter_by_eje(self, chunks: List[Dict], eje_activo: str) -> List[Dict]:
        """Filter chunks by active eje"""
        if not eje_activo:
            return chunks
        
        return [c for c in chunks if c['metadata']['eje'] == eje_activo]
    
    def filter_by_mode(self, chunks: List[Dict], mode: str) -> List[Dict]:
        """Filter chunks by study mode (theory/practice)"""
        return [c for c in chunks if c['metadata']['type'] == mode]
    
    def get_filtered_chunks(self, vector_temas: List[str] = None, 
                          eje_activo: str = None, 
                          mode: str = 'theory',
                          max_chunks: int = 10) -> List[Dict]:
        """Apply all filters in sequence"""
        chunks = self.chunks.copy()
        
        # 1. Filter by eje if specified
        if eje_activo:
            chunks = self.filter_by_eje(chunks, eje_activo)
            print(f"After eje filter ({eje_activo}): {len(chunks)} chunks")
        
        # 2. Filter by vector temas
        if vector_temas:
            chunks = self.filter_by_vector_temas(vector_temas)
            print(f"After vector temas filter: {len(chunks)} chunks")
        
        # 3. Filter by mode
        chunks = self.filter_by_mode(chunks, mode)
        print(f"After mode filter ({mode}): {len(chunks)} chunks")
        
        # 4. Limit number of chunks
        return chunks[:max_chunks]
    
    def generate_suggestions(self, vector_temas: List[str], mode: str = 'practice', 
                           eje_activo: str = None) -> List[str]:
        """Generate topic suggestions based on filtered chunks"""
        filtered_chunks = self.get_filtered_chunks(vector_temas, eje_activo, mode, max_chunks=20)
        
        if not filtered_chunks:
            return ["No se encontraron chunks relevantes para los temas especificados"]
        
        # Extract key concepts from chunks
        suggestions = []
        for i, chunk in enumerate(filtered_chunks[:5]):  # Top 5 chunks
            # Simple extraction of first sentence or key phrase
            text = chunk['text']
            sentences = text.split('.')
            if sentences:
                suggestion = sentences[0].strip()
                if len(suggestion) > 100:
                    suggestion = suggestion[:100] + "..."
                suggestions.append(f"{chunk['metadata']['eje']}: {suggestion}")
        
        return suggestions

def test_vector_temas_manager():
    """Test the VectorTemasManager functionality"""
    manager = VectorTemasManager()
    
    # Test vector temas
    test_temas = ["Funcion", "Funciones", "Vector", "Vectores"]
    
    print("Testing vector temas filtering...")
    filtered = manager.get_filtered_chunks(
        vector_temas=test_temas,
        mode='theory',
        max_chunks=5
    )
    
    print(f"\nFound {len(filtered)} relevant chunks:")
    for chunk in filtered:
        print(f"- {chunk['metadata']['label']}: {chunk['text'][:100]}...")
    
    # Test suggestions
    print("\nGenerating suggestions...")
    suggestions = manager.generate_suggestions(test_temas, mode='practice')
    for i, suggestion in enumerate(suggestions, 1):
        print(f"{i}. {suggestion}")

if __name__ == "__main__":
    test_vector_temas_manager()

import os
import json
import numpy as np
from pathlib import Path
from typing import List, Dict, Any
import re
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

class EnhancedChunker:
    def __init__(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.unidades = [
            'U1-Res. de Problemas',
            'U2-Alg. Computacionales',
            'U3-Est. de Control',
            'U4-Arreglos',
            'U5-Intro Prog.',
            'U6-Intro C++',
            'U7-Est. de Control',
            'U8-Funciones',
            'U9-Arreglos y Structs'
        ]
        
    def chunk_document(self, file_path: str, chunk_size: int = 500, overlap: int = 50) -> List[Dict]:
        """Chunk a document and assign metadata"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        chunks = []
        words = content.split()
        
        for i in range(0, len(words), chunk_size - overlap):
            chunk_words = words[i:i + chunk_size]
            chunk_text = ' '.join(chunk_words)
            
            if len(chunk_text.strip()) < 50:  # Skip very small chunks
                continue
                
            # Assign metadata
            eje = self.assign_eje(chunk_text)
            chunk_type = self.assign_type(chunk_text)
            label = f"{eje.replace(' ', '').replace('-', '')}_chunk_{len(chunks) + 1}"
            
            chunk = {
                'text': chunk_text,
                'metadata': {
                    'eje': eje,
                    'type': chunk_type,
                    'label': label,
                    'source_file': os.path.basename(file_path)
                }
            }
            chunks.append(chunk)
            
        return chunks
    
    def assign_eje(self, text: str) -> str:
        """Assign the most similar unit based on semantic similarity"""
        text_embedding = self.model.encode([text])
        unit_embeddings = self.model.encode(self.unidades)
        
        similarities = cosine_similarity(text_embedding, unit_embeddings)[0]
        best_unit_idx = np.argmax(similarities)
        
        return self.unidades[best_unit_idx]
    
    def assign_type(self, text: str) -> str:
        """Assign type based on keyword frequency"""
        exercise_keywords = ['ejercicio', 'problema', 'resolver', 'calcular', 'implementar', 'programar']
        
        text_lower = text.lower()
        exercise_count = sum(len(re.findall(rf'\b{keyword}\b', text_lower)) for keyword in exercise_keywords)
        
        return 'practice' if exercise_count > 5 else 'theory'
    
    def process_content_directory(self, content_dir: str = 'content') -> List[Dict]:
        """Process all files in content directory"""
        all_chunks = []
        content_path = Path(content_dir)
        
        if not content_path.exists():
            print(f"Content directory {content_dir} does not exist")
            return all_chunks
        
        for file_path in content_path.glob('*'):
            if file_path.is_file() and file_path.suffix in ['.txt', '.md']:
                print(f"Processing {file_path}")
                chunks = self.chunk_document(str(file_path))
                all_chunks.extend(chunks)
        
        return all_chunks
    
    def save_chunks_to_index(self, chunks: List[Dict], output_file: str = 'enhanced_chunks.json'):
        """Save chunks with metadata to JSON file"""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(chunks, f, ensure_ascii=False, indent=2)
        
        print(f"Saved {len(chunks)} chunks to {output_file}")

def main():
    chunker = EnhancedChunker()
    
    # Process all content
    chunks = chunker.process_content_directory()
    
    # Save to index
    chunker.save_chunks_to_index(chunks)
    
    # Print statistics
    theory_chunks = sum(1 for c in chunks if c['metadata']['type'] == 'theory')
    practice_chunks = sum(1 for c in chunks if c['metadata']['type'] == 'practice')
    
    print(f"\nStatistics:")
    print(f"Total chunks: {len(chunks)}")
    print(f"Theory chunks: {theory_chunks}")
    print(f"Practice chunks: {practice_chunks}")
    
    # Print distribution by eje
    eje_distribution = {}
    for chunk in chunks:
        eje = chunk['metadata']['eje']
        eje_distribution[eje] = eje_distribution.get(eje, 0) + 1
    
    print(f"\nDistribution by eje:")
    for eje, count in sorted(eje_distribution.items()):
        print(f"  {eje}: {count}")

if __name__ == "__main__":
    main()

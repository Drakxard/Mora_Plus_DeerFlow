#!/usr/bin/env python3
"""
Single Text Embedding Script for Mora + DeerFlow
Takes a text string as argument and returns its embedding as JSON
"""

import sys
import json
from sentence_transformers import SentenceTransformer

def load_model():
    """Load the sentence transformer model"""
    return SentenceTransformer('all-MiniLM-L6-v2')

def embed_text(model, text):
    """Create embedding for a single text"""
    embedding = model.encode([text])
    return embedding[0].tolist()

def main():
    """Main execution function"""
    if len(sys.argv) != 2:
        print(json.dumps({
            "error": "Usage: python3 embed_single.py '<text_to_embed>'"
        }))
        sys.exit(1)
    
    text = sys.argv[1]
    
    if not text.strip():
        print(json.dumps({
            "error": "Text cannot be empty"
        }))
        sys.exit(1)
    
    try:
        # Load model
        model = load_model()
        
        # Create embedding
        embedding = embed_text(model, text)
        
        # Return result as JSON
        result = {
            "text": text,
            "embedding": embedding,
            "model": "all-MiniLM-L6-v2",
            "embedding_dim": len(embedding)
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()

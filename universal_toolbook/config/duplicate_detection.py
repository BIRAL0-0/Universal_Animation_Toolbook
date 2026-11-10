import json
import os
from difflib import SequenceMatcher
from pathlib import Path

DEFAULT_REPO_ROOT = str(Path(__file__).resolve().parents[2])

def load_index(repo_root=None):
    repo_root = repo_root or DEFAULT_REPO_ROOT
    index_path = os.path.join(repo_root, "videos", "index.json")
    if not os.path.exists(index_path):
        return {"videos": []}
    with open(index_path, 'r') as f:
        return json.load(f)

def similarity(a, b):
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def check_duplicate(new_concept, repo_root=None):
    repo_root = repo_root or DEFAULT_REPO_ROOT
    """
    new_concept: dict with keys: title, topic, script_summary, content_fingerprint
    Returns: (is_duplicate, overlap_video, reason)
    """
    index = load_index(repo_root)
    
    for video in index.get("videos", []):
        # 1. Exact title match
        if new_concept.get("title", "").lower() == video.get("title", "").lower():
            return True, video, "Exact title match"
        
        # 2. Content fingerprint match
        if new_concept.get("content_fingerprint") == video.get("content_fingerprint"):
            return True, video, "Content fingerprint match"
        
        # 3. Topic similarity (> 0.8)
        topic_sim = similarity(new_concept.get("topic", ""), video.get("topic", ""))
        if topic_sim > 0.8:
            return True, video, f"Topic similarity ({topic_sim:.2f})"
        
        # 4. Script summary similarity (> 0.7)
        summary_sim = similarity(new_concept.get("script_summary", ""), video.get("script_summary", ""))
        if summary_sim > 0.7:
            return True, video, f"Script summary similarity ({summary_sim:.2f})"
            
        # 5. Tag overlap (>= 3 common tags)
        new_tags = set(new_concept.get("tags", []))
        existing_tags = set(video.get("tags", []))
        overlap = new_tags.intersection(existing_tags)
        if len(overlap) >= 3:
            return True, video, f"Tag overlap: {overlap}"
            
    return False, None, "No substantial overlap"

def add_video(record, repo_root=None):
    repo_root = repo_root or DEFAULT_REPO_ROOT
    index = load_index(repo_root)
    index["videos"].append(record)
    index["total_videos"] = len(index["videos"])
    index["last_updated"] = "2026-11-10"
    index_path = os.path.join(repo_root, "videos", "index.json")
    with open(index_path, 'w') as f:
        json.dump(index, f, indent=2)


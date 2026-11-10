import json
import os
import unittest

class TestVideoIndex(unittest.TestCase):
    def setUp(self):
        self.repo_root = "/home/user/Universal_Animation_Toolbook"
        self.index_path = os.path.join(self.repo_root, "videos", "index.json")
        
    def test_index_exists(self):
        self.assertTrue(os.path.exists(self.index_path))
        
    def test_index_structure(self):
        with open(self.index_path, 'r') as f:
            index = json.load(f)
        self.assertIn("videos", index)
        self.assertIn("total_videos", index)
        self.assertIn("last_updated", index)
        self.assertGreater(index["total_videos"], 0)
        
    def test_video_records(self):
        with open(self.index_path, 'r') as f:
            index = json.load(f)
        for video in index["videos"]:
            required_keys = ["id", "title", "topic", "format", "duration_sec", 
                             "status", "created_at", "final_video", "script_summary",
                             "content_fingerprint", "tags", "production_version"]
            for key in required_keys:
                self.assertIn(key, video, f"Missing key {key} in video {video.get('id')}")
                
    def test_duplicate_detection_integration(self):
        # Import the duplicate detection module
        import sys
        sys.path.append(os.path.join(self.repo_root, "universal_toolbook", "config"))
        from duplicate_detection import check_duplicate, load_index
        
        index = load_index(self.repo_root)
        self.assertGreater(len(index["videos"]), 0)
        
        # Test exact title match
        existing = index["videos"][0]
        new_concept = {
            "title": existing["title"],
            "topic": "different topic",
            "script_summary": "different summary",
            "content_fingerprint": "different-hash"
        }
        is_dup, overlap, reason = check_duplicate(new_concept, self.repo_root)
        self.assertTrue(is_dup)
        self.assertEqual(overlap["id"], existing["id"])
        self.assertIn("Exact title match", reason)

if __name__ == '__main__':
    unittest.main()

import json
import os
import sys
import unittest

class TestFullWorkflow(unittest.TestCase):
    def setUp(self):
        self.repo_root = "/home/user/Universal_Animation_Toolbook"
        self.index_path = os.path.join(self.repo_root, "videos", "index.json")
        sys.path.append(os.path.join(self.repo_root, "universal_toolbook", "config"))
        from duplicate_detection import check_duplicate, load_index
        self.check_duplicate = check_duplicate
        self.load_index = load_index

    def test_duplicate_prevention_system(self):
        index = self.load_index(self.repo_root)
        self.assertGreater(len(index["videos"]), 0)
        
        # Test 1: Exact title match should trigger duplicate
        existing = index["videos"][0]
        new_concept = {
            "title": existing["title"],
            "topic": "different topic",
            "script_summary": "different summary",
            "content_fingerprint": "different-hash",
            "tags": ["new", "tag"]
        }
        is_dup, overlap, reason = self.check_duplicate(new_concept, self.repo_root)
        self.assertTrue(is_dup)
        self.assertEqual(overlap["id"], existing["id"])
        self.assertIn("Exact title match", reason)
        
        # Test 2: Different concept should NOT trigger duplicate
        new_concept2 = {
            "title": "A Completely New Video Concept",
            "topic": "Unique topic never seen before",
            "script_summary": "A unique narrative about something entirely different.",
            "content_fingerprint": "unique-hash-12345",
            "tags": ["unique", "concept"]
        }
        is_dup2, overlap2, reason2 = self.check_duplicate(new_concept2, self.repo_root)
        self.assertFalse(is_dup2)
        self.assertIsNone(overlap2)
        
        # Test 3: Content fingerprint match
        new_concept3 = {
            "title": "Different Title",
            "topic": "Different Topic",
            "script_summary": "Different Summary",
            "content_fingerprint": existing["content_fingerprint"],
            "tags": ["different"]
        }
        is_dup3, overlap3, reason3 = self.check_duplicate(new_concept3, self.repo_root)
        self.assertTrue(is_dup3)
        self.assertEqual(overlap3["id"], existing["id"])
        self.assertIn("Content fingerprint match", reason3)

    def test_runtime_isolation(self):
        runtime_path = os.path.join(self.repo_root, "runtime")
        videos_path = os.path.join(self.repo_root, "videos")
        self.assertTrue(os.path.exists(runtime_path))
        self.assertTrue(os.path.exists(videos_path))
        self.assertNotEqual(runtime_path, videos_path)
        
        # Ensure runtime is Git-ignored
        gitignore_path = os.path.join(self.repo_root, ".gitignore")
        with open(gitignore_path, 'r') as f:
            content = f.read()
        self.assertIn("runtime/", content)

if __name__ == '__main__':
    unittest.main()

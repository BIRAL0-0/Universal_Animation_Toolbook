import os
import shutil
import unittest

class TestCleanupProcedure(unittest.TestCase):
    def setUp(self):
        self.repo_root = "/home/user/Universal_Animation_Toolbook"
        self.runtime_path = os.path.join(self.repo_root, "runtime")
        # Create temporary files for testing
        self.test_job = os.path.join(self.runtime_path, "jobs", "test-job")
        os.makedirs(self.test_job, exist_ok=True)
        with open(os.path.join(self.test_job, "test_render.mp4"), 'w') as f:
            f.write("dummy content")
        with open(os.path.join(self.test_job, "test_log.txt"), 'w') as f:
            f.write("dummy log")
            
    def tearDown(self):
        if os.path.exists(self.test_job):
            shutil.rmtree(self.test_job)
            
    def test_runtime_structure(self):
        self.assertTrue(os.path.exists(self.runtime_path))
        jobs_path = os.path.join(self.runtime_path, "jobs")
        self.assertTrue(os.path.exists(jobs_path))
        
    def test_temporary_workspace_isolation(self):
        # Ensure runtime is separate from videos
        videos_path = os.path.join(self.repo_root, "videos")
        self.assertTrue(os.path.exists(videos_path))
        self.assertNotEqual(self.runtime_path, videos_path)
        
    def test_git_ignore_runtime(self):
        gitignore_path = os.path.join(self.repo_root, ".gitignore")
        self.assertTrue(os.path.exists(gitignore_path))
        with open(gitignore_path, 'r') as f:
            content = f.read()
        self.assertIn("runtime/", content)

if __name__ == '__main__':
    unittest.main()

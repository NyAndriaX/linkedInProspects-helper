"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Post, PostStats, PostStatus, PostFormData } from "@/types/post";
import { apiClient } from "@/lib/api-client";

interface PublishResult {
  success: boolean;
  error?: string;
  linkedInPostId?: string;
}

interface PublishResponse {
  success: boolean;
  linkedInPostId?: string;
  error?: string;
}

/**
 * Hook for managing posts with API/Prisma persistence
 */
export function usePosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  // Fetch posts from API
  const fetchPosts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.get<Post[]>("/api/posts");
      setPosts(data);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Add a new post
  const addPost = useCallback(async (data: PostFormData): Promise<Post | null> => {
    try {
      const newPost = await apiClient.post<Post>("/api/posts", data);
      setPosts((prev) => [newPost, ...prev]);
      return newPost;
    } catch (error) {
      console.error("Error creating post:", error);
      return null;
    }
  }, []);

  // Update a post
  const updatePost = useCallback(
    async (id: string, updates: Partial<Omit<Post, "id" | "createdAt" | "userId">>): Promise<boolean> => {
      try {
        const updatedPost = await apiClient.put<Post>(`/api/posts/${id}`, updates);
        setPosts((prev) => prev.map((post) => (post.id === id ? updatedPost : post)));
        return true;
      } catch (error) {
        console.error("Error updating post:", error);
        return false;
      }
    },
    []
  );

  // Delete a post
  const deletePost = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiClient.delete(`/api/posts/${id}`);
      setPosts((prev) => prev.filter((post) => post.id !== id));
      return true;
    } catch (error) {
      console.error("Error deleting post:", error);
      return false;
    }
  }, []);

  // Publish a post to LinkedIn
  const publishPost = useCallback(
    async (id: string): Promise<PublishResult> => {
      const post = posts.find((p) => p.id === id);
      if (!post) {
        return { success: false, error: "Post not found" };
      }

      setIsPublishing(true);

      try {
        const data = await apiClient.post<PublishResponse>("/api/linkedin/publish", {
          content: post.content,
          postId: id,
        });

        // Refetch posts to get updated status and linkedInUrn from server
        await fetchPosts();

        return { success: true, linkedInPostId: data.linkedInPostId };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Network error. Please try again.";
        return { success: false, error: message };
      } finally {
        setIsPublishing(false);
      }
    },
    [posts, fetchPosts]
  );

  // Get post by ID
  const getPost = useCallback(
    (id: string) => posts.find((post) => post.id === id),
    [posts]
  );

  // Filter posts by status
  const filterByStatus = useCallback(
    (status: PostStatus | "all") => {
      if (status === "all") return posts;
      return posts.filter((post) => post.status === status);
    },
    [posts]
  );

  // Calculate stats (memoized for performance)
  const stats = useMemo<PostStats>(() => {
    const draft = posts.filter((p) => p.status === "draft").length;
    const ready = posts.filter((p) => p.status === "ready").length;
    const published = posts.filter((p) => p.status === "published").length;
    const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
    const totalReactions = posts.reduce((sum, p) => sum + (p.reactions || 0), 0);

    return { total: posts.length, draft, ready, published, totalViews, totalReactions };
  }, [posts]);

  return {
    posts,
    isLoading,
    isPublishing,
    stats,
    addPost,
    updatePost,
    deletePost,
    publishPost,
    getPost,
    filterByStatus,
    refetch: fetchPosts,
  };
}

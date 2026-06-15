'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface EditRecord {
  id: string;
  editType: string;
  changeDescription?: string;
  wordCount?: number;
  characterCount?: number;
  createdAt: string;
  editor: { firstName: string; lastName: string };
}

interface Comment {
  id: string;
  content: string;
  articleRef?: string;
  isResolved: boolean;
  createdAt: string;
  author: { firstName: string; lastName: string };
}

type Tab = 'editor' | 'history' | 'comments';

const EDIT_TYPE_COLORS: Record<string, string> = {
  CONTENT: 'bg-blue-100 text-blue-700',
  FORMATTING: 'bg-purple-100 text-purple-700',
  STRUCTURE: 'bg-amber-100 text-amber-700',
  ANNOTATION: 'bg-green-100 text-green-700',
};

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('editor');

  // Editor state
  const [content, setContent] = useState('');
  const [changeDesc, setChangeDesc] = useState('');
  const [editType, setEditType] = useState('CONTENT');
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [articleRef, setArticleRef] = useState('');

  // Numbered content (right panel)
  const { data: numberedContent } = useQuery({
    queryKey: ['editor-numbered', id],
    queryFn: async () => {
      const res = await apiClient.get<string>(`/editor/${id}/numbered`);
      return res.data;
    },
  });

  // Edit history
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['editor-history', id],
    queryFn: async () => {
      const res = await apiClient.get<EditRecord[]>(`/editor/${id}/history`);
      return res.data;
    },
    enabled: activeTab === 'history',
  });

  // Comments
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['editor-comments', id, includeResolved],
    queryFn: async () => {
      const res = await apiClient.get<Comment[]>(
        `/editor/${id}/comments?includeResolved=${includeResolved}`,
      );
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/editor/${id}/save`, {
        content,
        changeDescription: changeDesc || undefined,
        editType,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor-history', id] });
      setChangeDesc('');
      alert('Edit saved successfully.');
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/editor/${id}/comments`, {
        content: newComment,
        articleRef: articleRef || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor-comments', id] });
      setNewComment('');
      setArticleRef('');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await apiClient.patch(`/editor/comments/${commentId}/resolve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor-comments', id] });
    },
  });

  return (
    <main className="flex-1 flex flex-col h-full" aria-labelledby="editor-heading">
      {/* Header */}
      <header className="border-b border-border bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 id="editor-heading" className="text-xl font-bold text-primary-navy">
            Document Editor
          </h1>
          <p className="text-sm text-muted-foreground">Legislative Item: {id}</p>
        </div>
        <div className="flex gap-2">
          {(['editor', 'history', 'comments'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === t
                  ? 'bg-primary-navy text-white'
                  : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              aria-pressed={activeTab === t}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {/* Editor Tab */}
      {activeTab === 'editor' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Textarea */}
          <div className="flex flex-col flex-1 p-4 min-w-0">
            <div className="mb-3 flex gap-3 flex-wrap">
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                aria-label="Edit type"
              >
                {['CONTENT', 'FORMATTING', 'STRUCTURE', 'ANNOTATION'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                type="text"
                value={changeDesc}
                onChange={(e) => setChangeDesc(e.target.value)}
                placeholder="Change description (optional)"
                className="flex-1 min-w-48 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                aria-label="Change description"
              />
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!content.trim() || saveMutation.isPending}
                className="rounded-md bg-primary-navy px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-opacity-90"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 w-full rounded-lg border border-gray-300 p-4 font-mono text-sm resize-none focus:border-primary-gold focus:outline-none"
              placeholder="Type or paste document content here..."
              aria-label="Document content editor"
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-muted-foreground text-right">
              Words: {content.trim() ? content.trim().split(/\s+/).length : 0} | Characters: {content.length}
            </p>
          </div>

          {/* Right: Article/Clause Preview */}
          <aside
            className="w-80 border-l border-border bg-gray-50 flex flex-col shrink-0"
            aria-label="Document structure preview"
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary-navy">Structure Preview</h2>
            </div>
            <pre className="flex-1 overflow-y-auto p-4 text-xs font-mono whitespace-pre-wrap text-gray-700">
              {numberedContent ?? 'No structure defined.'}
            </pre>
          </aside>

          {/* Comments Panel (collapsible) */}
          <aside
            className={`border-l border-border bg-white flex flex-col shrink-0 transition-all ${commentsOpen ? 'w-72' : 'w-10'}`}
            aria-label="Comments panel"
          >
            <button
              onClick={() => setCommentsOpen((v) => !v)}
              className="px-3 py-3 text-xs font-semibold text-primary-navy hover:bg-gray-50 flex items-center gap-1"
              aria-expanded={commentsOpen}
            >
              {commentsOpen ? '→' : '←'}
              {commentsOpen && <span>Comments ({comments.length})</span>}
            </button>
            {commentsOpen && (
              <div className="flex flex-col flex-1 overflow-hidden px-3 pb-3">
                <div className="mb-2">
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={includeResolved}
                      onChange={(e) => setIncludeResolved(e.target.checked)}
                    />
                    Show resolved
                  </label>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 mb-3">
                  {commentsLoading ? (
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  ) : comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No comments yet.</p>
                  ) : (
                    comments.map((c) => (
                      <div
                        key={c.id}
                        className={`rounded-md border p-2 text-xs ${c.isResolved ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-primary-gold/40 bg-amber-50'}`}
                      >
                        <p className="font-medium text-primary-navy mb-0.5">
                          {c.author.firstName} {c.author.lastName}
                          {c.articleRef && (
                            <span className="ml-1 font-normal text-muted-foreground">({c.articleRef})</span>
                          )}
                        </p>
                        <p className="text-gray-700 leading-snug">{c.content}</p>
                        {!c.isResolved && (
                          <button
                            onClick={() => resolveMutation.mutate(c.id)}
                            disabled={resolveMutation.isPending}
                            className="mt-1 text-green-600 hover:underline"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {/* Add comment */}
                <div className="space-y-1">
                  <input
                    type="text"
                    value={articleRef}
                    onChange={(e) => setArticleRef(e.target.value)}
                    placeholder="Article ref (optional)"
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    aria-label="Article reference"
                  />
                  <textarea
                    rows={3}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs resize-none"
                    aria-label="New comment content"
                  />
                  <button
                    onClick={() => addCommentMutation.mutate()}
                    disabled={!newComment.trim() || addCommentMutation.isPending}
                    className="w-full rounded bg-primary-navy py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {addCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="mb-4 text-lg font-semibold text-primary-navy">Edit History</h2>
          {historyLoading ? (
            <p className="text-muted-foreground">Loading history...</p>
          ) : history.length === 0 ? (
            <p className="text-muted-foreground">No edits yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map((edit, i) => (
                <div key={edit.id} className="rounded-lg border border-border bg-white p-4 flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-navy/10 flex items-center justify-center text-xs font-bold text-primary-navy">
                    {history.length - i}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${EDIT_TYPE_COLORS[edit.editType] ?? 'bg-gray-100 text-gray-700'}`}>
                        {edit.editType}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        by {edit.editor.firstName} {edit.editor.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(edit.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {edit.changeDescription && (
                      <p className="text-sm text-gray-700 mb-1">{edit.changeDescription}</p>
                    )}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {edit.wordCount != null && <span>{edit.wordCount} words</span>}
                      {edit.characterCount != null && <span>{edit.characterCount} chars</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comments Tab */}
      {activeTab === 'comments' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary-navy">Review Comments</h2>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={includeResolved}
                onChange={(e) => setIncludeResolved(e.target.checked)}
              />
              Show resolved
            </label>
          </div>
          {commentsLoading ? (
            <p className="text-muted-foreground">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-muted-foreground">No comments found.</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-lg border p-4 ${c.isResolved ? 'border-gray-200 bg-gray-50' : 'border-amber-200 bg-amber-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-sm text-primary-navy">
                        {c.author.firstName} {c.author.lastName}
                      </span>
                      {c.articleRef && (
                        <span className="ml-2 text-xs text-muted-foreground bg-gray-100 rounded px-1 py-0.5">
                          {c.articleRef}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {c.isResolved ? (
                        <span className="text-xs text-green-600 font-medium">Resolved</span>
                      ) : (
                        <button
                          onClick={() => resolveMutation.mutate(c.id)}
                          disabled={resolveMutation.isPending}
                          className="text-xs bg-green-600 text-white rounded px-2 py-0.5 hover:bg-green-700 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">{c.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Add comment form */}
          <div className="mt-6 rounded-lg border border-border bg-white p-4">
            <h3 className="text-sm font-semibold text-primary-navy mb-3">Add Comment</h3>
            <div className="space-y-2">
              <input
                type="text"
                value={articleRef}
                onChange={(e) => setArticleRef(e.target.value)}
                placeholder="Article reference (e.g. Article 3, Clause 2)"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                aria-label="Article reference"
              />
              <textarea
                rows={4}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write your comment..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-y"
                aria-label="Comment content"
              />
              <button
                onClick={() => addCommentMutation.mutate()}
                disabled={!newComment.trim() || addCommentMutation.isPending}
                className="rounded-md bg-primary-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-opacity-90"
              >
                {addCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

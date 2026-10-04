import React from 'react';
import DOMPurify from 'dompurify';

interface CommentViewProps {
  /** 
   * The HTML string containing the comment. 
   * Example: "This is <b>bold</b>, <i>italic</i>, and a <a href='https://example.com'>link</a>."
   */
  htmlContent: string;
  
  /** Optional CSS class name for styling the container */
  className?: string;
}

export const CommentView: React.FC<CommentViewProps> = ({ htmlContent, className = '' }) => {
  // Sanitize the HTML to prevent XSS attacks before rendering it
  const sanitizedHTML = {
    __html: DOMPurify.sanitize(htmlContent, {
      // Configure allowed tags and attributes if necessary
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    }),
  };

  return (
    <div 
      className={`comment-view ${className}`}
      style={{
        padding: '12px',
        border: '1px solid #e1e4e8',
        borderRadius: '6px',
        backgroundColor: '#f6f8fa',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#24292e',
        lineHeight: '1.5',
      }}
    >
      {/* 
        dangerouslySetInnerHTML is required here to render the HTML tags.
        DOMPurify ensures that only safe HTML is rendered.
      */}
      <div 
        dangerouslySetInnerHTML={sanitizedHTML} 
        style={{ wordBreak: 'break-word' }}
      />
    </div>
  );
};

export default CommentView;

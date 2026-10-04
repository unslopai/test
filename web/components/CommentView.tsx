import React from 'react';
import ReactDOM from 'react-dom';
import CommentView from './CommentView';

const App: React.FC = () => {
  const commentWithFormatting = "<p><strong>Hey!</strong> This is a <i>formatted</i> comment with a <a href='https://www.example.com'>link</a>.</p>";

  return (
    <div>
      <h1>Comment Example</h1>
      <CommentView comment={commentWithFormatting} />
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));

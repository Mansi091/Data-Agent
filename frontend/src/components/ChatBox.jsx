import { useState, useEffect, useRef } from "react";

function ChatBox({ filename }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!question.trim() || loading) return;

    const currentQuestion = question;
    const userMessage = {
      sender: "user",
      text: currentQuestion
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          filename: filename,
          question: currentQuestion
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: data.detail || "Server returned an error."
          }
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data.answer
        }
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Failed to connect to backend. Please check if the backend server is running."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <h2 className="chat-title">Dataset Chat ({filename})</h2>

      {/* Messages Box */}
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.sender}`}>
            <span className="chat-sender-name">
              {msg.sender === "user" ? "You" : "AI Assistant"}
            </span>
            <div className="chat-text">{msg.text}</div>
          </div>
        ))}
        
        {loading && (
          <div className="chat-message bot typing">
            <span className="chat-sender-name">AI Assistant</span>
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input and Button Area */}
      <div className="chat-input-area">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSend();
            }
          }}
          placeholder="Ask a question..."
          className="chat-input"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          className="chat-send-btn"
          disabled={loading || !question.trim()}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default ChatBox;

import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Send, BookOpen, Sparkles, MessageSquarePlus } from 'lucide-react';
import MessageBubble from '@/components/agent/MessageBubble';
import { useToast } from '@/components/ui/use-toast';

const AGENT_NAME = 'bible_study_companion';

export default function BibleStudyCompanion() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!activeConversation) return;
    const unsub = base44.agents.subscribeToConversation(activeConversation, (data) => {
      setMessages(data.messages || []);
    });
    return () => unsub();
  }, [activeConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const convs = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      setConversations(convs || []);
      if (convs?.length > 0 && !activeConversation) {
        setActiveConversation(convs[0].id);
      }
    } catch (err) {
      toast({ title: 'Error loading conversations', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const startNewConversation = async () => {
    try {
      setSending(true);
      const conv = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: 'New Reflection', description: 'Bible Study Companion conversation' },
      });
      setConversations(prev => [conv, ...prev]);
      setActiveConversation(conv.id);
      setMessages([]);
    } catch (err) {
      toast({ title: 'Error starting conversation', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    let convId = activeConversation;
    let conv = conversations.find(c => c.id === convId);

    if (!conv) {
      try {
        conv = await base44.agents.createConversation({
          agent_name: AGENT_NAME,
          metadata: { name: input.slice(0, 40), description: 'Bible Study Companion conversation' },
        });
        convId = conv.id;
        setConversations(prev => [conv, ...prev]);
        setActiveConversation(convId);
        setMessages([]);
      } catch (err) {
        toast({ title: 'Error creating conversation', description: err.message, variant: 'destructive' });
        return;
      }
    }

    const userMessage = input.trim();
    setInput('');
    setSending(true);

    try {
      const updatedConv = await base44.agents.addMessage(conv, { role: 'user', content: userMessage });
      setMessages(updatedConv.messages || []);
    } catch (err) {
      toast({ title: 'Error sending message', description: err.message, variant: 'destructive' });
      setInput(userMessage);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="font-semibold text-lg">Bible Study Companion</h1>
          <p className="text-sm text-muted-foreground">Reflect on past studies and get personalized answers from your church's Bible study history</p>
        </div>
        <Button variant="outline" size="sm" onClick={startNewConversation} disabled={sending} className="gap-2">
          <MessageSquarePlus className="w-4 h-4" /> New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Start a Reflection</h2>
            <p className="text-muted-foreground mb-6">Ask about a scripture, request a reflection on a past topic, or explore themes from your church's Bible studies.</p>
            <div className="space-y-2 w-full">
              {[
                "Give me a reflection on what we've studied recently",
                "What scriptures have we covered about prayer?",
                "Summarize our last Bible study session",
              ].map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3 whitespace-normal"
                  onClick={() => { setInput(suggestion); }}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => <MessageBubble key={idx} message={msg} />)}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about a scripture, request a reflection, or explore a topic..."
            disabled={sending}
          />
          <Button onClick={sendMessage} disabled={!input.trim() || sending} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
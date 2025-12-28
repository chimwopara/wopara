import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, MessageSquare, ChevronLeft, ChevronRight, Book } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import Header from "@/components/Header";
import PromptBuilder from "@/components/PromptBuilder";
import CodeBlock from "@/components/CodeBlock";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { SavedCode, SavedPrompt } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const QUESTIONS = [
  {
    id: 'platform',
    question: "What programming language or framework are you using? (e.g., JavaScript, Swift, React)",
    required: true
  },
  {
    id: 'device',
    question: "What device or platform are you targeting? (e.g., web, iPhone, Android)",
    required: true
  },
  {
    id: 'element',
    question: "What UI element do you want to create? (e.g., search bar, button, card)",
    required: true
  },
  {
    id: 'reference',
    question: "Which app would you like to reference for styling? (e.g., Instagram, WhatsApp)",
    required: true
  },
  {
    id: 'background',
    question: "Would you like a specific background color? (optional, in hex)",
    required: false
  }
];

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

export default function Playground() {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [output, setOutput] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [showAddCodeDialog, setShowAddCodeDialog] = useState(false);
  const [showAddPromptDialog, setShowAddPromptDialog] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: QUESTIONS[0].question
  }]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [userInput, setUserInput] = useState("");
  const [prompt, setPrompt] = useState("");
  const [activeTab, setActiveTab] = useState<string | null>("chat");
  const [isTyping, setIsTyping] = useState(false);
  const { toast } = useToast();

  const { data: savedCodes = [] } = useQuery<SavedCode[]>({
    queryKey: ['/api/saved-codes'],
  });

  const { data: savedPrompts = [] } = useQuery<SavedPrompt[]>({
    queryKey: ['/api/saved-prompts'],
  });

  const createCodeMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest('POST', '/api/saved-codes', {
        name: `Code ${savedCodes.length + 1}`,
        content,
        isPublic: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-codes'] });
      setShowAddCodeDialog(false);
      setNewCode("");
      toast({
        title: "Code Saved",
        description: "Your code has been saved successfully",
      });
    },
  });

  const deleteCodeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/saved-codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-codes'] });
      toast({
        title: "Code Deleted",
        description: "Your code has been deleted successfully",
      });
    },
  });

  const updateVisibilityMutation = useMutation({
    mutationFn: async ({ id, isPublic }: { id: number; isPublic: boolean }) => {
      await apiRequest('PATCH', `/api/saved-codes/${id}/visibility`, { isPublic });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-codes'] });
    },
  });

  const createPromptMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest('POST', '/api/saved-prompts', {
        name: `Prompt ${savedPrompts.length + 1}`,
        content,
        isPublic: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-prompts'] });
      setShowAddPromptDialog(false);
      setNewPrompt("");
      toast({
        title: "Prompt Saved",
        description: "Your prompt has been saved successfully",
      });
    },
  });

  const deletePromptMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/saved-prompts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-prompts'] });
      toast({
        title: "Prompt Deleted",
        description: "Your prompt has been deleted successfully",
      });
    },
  });

  const updatePromptVisibilityMutation = useMutation({
    mutationFn: async ({ id, isPublic }: { id: number; isPublic: boolean }) => {
      await apiRequest('PATCH', `/api/saved-prompts/${id}/visibility`, { isPublic });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-prompts'] });
    },
  });

  const handleSaveCode = async () => {
    if (!newCode.trim()) {
      toast({
        title: "Error",
        description: "Please provide code content",
        variant: "destructive",
      });
      return;
    }

    try {
      await createCodeMutation.mutateAsync(newCode);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save code",
        variant: "destructive",
      });
    }
  };

  const handleSavePrompt = async () => {
    if (!newPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please provide prompt content",
        variant: "destructive",
      });
      return;
    }

    try {
      await createPromptMutation.mutateAsync(newPrompt);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save prompt",
        variant: "destructive",
      });
    }
  };

  const handleVisibilityChange = async (code: SavedCode, isPublic: boolean) => {
    try {
      await updateVisibilityMutation.mutateAsync({ id: code.id, isPublic });
      toast({
        title: "Visibility Updated",
        description: `Code is now ${isPublic ? 'public' : 'private'}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update code visibility",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCode = async (code: SavedCode) => {
    try {
      await deleteCodeMutation.mutateAsync(code.id);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete code",
        variant: "destructive",
      });
    }
  };

  const handleDeletePrompt = async (prompt: SavedPrompt) => {
    try {
      await deletePromptMutation.mutateAsync(prompt.id);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete prompt",
        variant: "destructive",
      });
    }
  };

  const handlePromptVisibilityChange = async (prompt: SavedPrompt, isPublic: boolean) => {
    try {
      await updatePromptVisibilityMutation.mutateAsync({ id: prompt.id, isPublic });
      toast({
        title: "Visibility Updated",
        description: `Prompt is now ${isPublic ? 'public' : 'private'}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update prompt visibility",
        variant: "destructive",
      });
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      const prevQuestion = currentQuestion - 1;
      setCurrentQuestion(prevQuestion);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: QUESTIONS[prevQuestion].question
      }]);
    }
  };

  const handleSkip = () => {
    if (currentQuestion < QUESTIONS.length - 1) {
      const nextQuestion = currentQuestion + 1;
      setCurrentQuestion(nextQuestion);
      setAnswers(prev => ({
        ...prev,
        [QUESTIONS[currentQuestion].id]: "skipped"
      }));
      setMessages(prev => [
        ...prev,
        { role: 'user', content: 'Skipped' },
        { role: 'assistant', content: QUESTIONS[nextQuestion].question }
      ]);
    }
  };

  const handleSendMessage = () => {
    if (!userInput.trim()) return;

    setMessages(prev => [...prev, {
      role: 'user',
      content: userInput
    }]);

    const currentQ = QUESTIONS[currentQuestion];
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: userInput
    }));

    if (currentQuestion < QUESTIONS.length - 1) {
      const nextQuestion = currentQuestion + 1;
      setCurrentQuestion(nextQuestion);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: QUESTIONS[nextQuestion].question
      }]);
    } else {
      const prompt = constructPrompt(answers);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Here's your ChimPrompt:\n${prompt}`
      }]);
      setOutput(prompt);
      setPrompt(prompt);
      setTimeout(() => {
        setMessages([{
          role: 'assistant',
          content: QUESTIONS[0].question
        }]);
        setCurrentQuestion(0);
        setAnswers({});
      }, 5000);
    }

    setUserInput("");
  };

  const constructPrompt = (data: Record<string, string>) => {
    let promptParts = [];

    if (data.platform) promptParts.push(`*in* ${data.platform.toLowerCase()}`);
    if (data.device) promptParts.push(`*for* ${data.device.toLowerCase()}`);
    if (data.element) promptParts.push(`*create* ${data.element.toLowerCase()}`);
    if (data.reference) promptParts.push(`*from* ${data.reference.toLowerCase()}`);
    if (data.background) promptParts.push(`*background* ${data.background}`);

    return promptParts.join(' | ');
  };

  const handlePromptChange = (newPrompt: string) => {
    setPrompt(newPrompt);
    const hasContent = !!newPrompt.trim();
    setIsTyping(hasContent);
    setActiveTab(hasContent ? null : "chat");
  };

  const handlePromptComplete = () => {
    setIsTyping(false);
    if (!prompt.trim()) {
      setActiveTab("chat");
    }
  };

  const handleTabChange = (tab: string) => {
    // Allow tab changes if there's no content or if we're not typing
    if (!prompt.trim() || !isTyping) {
      setActiveTab(tab);
    }
  };

  const switchToTab = (elementType: string) => {
    // Always allow switching if there's no content
    if (!prompt.trim()) {
      switch (elementType) {
        case 'context':
        case 'chimcontext':
          setActiveTab('codes');
          break;
        case 'prompt':
        case 'chimprompt':
          setActiveTab('prompts');
          break;
        default:
          setActiveTab('chat');
      }
      return;
    }

    // Only block switching if we're actively typing with content
    if (!isTyping) {
      switch (elementType) {
        case 'context':
        case 'chimcontext':
          setActiveTab('codes');
          break;
        case 'prompt':
        case 'chimprompt':
          setActiveTab('prompts');
          break;
        default:
          setActiveTab('chat');
      }
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-6 pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex gap-4">
            <div className="w-1/2">
              <PromptBuilder
                onExecute={setOutput}
                value={prompt}
                onChange={handlePromptChange}
                onComplete={handlePromptComplete}
                onElementClick={switchToTab}
              />
            </div>

            <div className="w-1/2">
              <Card className="h-full">
                <CardContent className="pt-4">
                  <Tabs value={activeTab || undefined} onValueChange={handleTabChange}>
                    <TabsList className="w-full">
                      <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
                      <TabsTrigger value="codes" className="flex-1">Contexts</TabsTrigger>
                      <TabsTrigger value="prompts" className="flex-1">Prompts</TabsTrigger>
                    </TabsList>

                    <TabsContent value="chat" className="mt-4 relative h-[calc(100vh-250px)]">
                      <div className="flex flex-col h-full">
                        <div
                          ref={chatContainerRef}
                          className="flex-1 overflow-y-auto space-y-4 p-4 pb-20"
                        >
                          {messages.map((message, index) => (
                            <div
                              key={index}
                              className={`flex ${
                                message.role === 'assistant' ? 'justify-start' : 'justify-end'
                              }`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                  message.role === 'assistant'
                                    ? 'bg-muted text-foreground'
                                    : 'bg-primary text-primary-foreground'
                                }`}
                              >
                                {message.content}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1 mr-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleBack}
                                disabled={currentQuestion === 0}
                                title="Go back to previous question"
                                className="h-7 w-7 bg-transparent hover:bg-transparent focus:ring-0 focus:ring-offset-0"
                              >
                                <ChevronLeft className="h-3 w-3 text-muted-foreground/40" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleSkip}
                                disabled={currentQuestion === QUESTIONS.length - 1}
                                title="Skip this question"
                                className="h-7 w-7 bg-transparent hover:bg-transparent focus:ring-0 focus:ring-offset-0"
                              >
                                <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                              </Button>
                            </div>
                            <Input
                              value={userInput}
                              onChange={(e) => setUserInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                              placeholder="Type your answer..."
                              className="flex-1"
                            />
                            <Link href="/info">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                              >
                                <Book className="h-3 w-3" />
                                Info
                              </Button>
                            </Link>
                            {userInput.trim() && (
                              <Button
                                onClick={handleSendMessage}
                                size="icon"
                                className="h-9 w-9 rounded-full bg-[#007AFF] hover:bg-[#007AFF]/90 transition-all"
                              >
                                <MessageSquare className="h-4 w-4 text-white" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="codes" className="mt-4">
                      <div className="space-y-4">
                        {savedCodes.map((code, index) => (
                          <Card key={code.id}>
                            <div className="p-6">
                              <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteCode(code)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <h3 className="font-medium">Code {index + 1}</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                  <code className="text-sm text-muted-foreground">
                                    {code.isPublic ? code.chimContextId : `context:${index + 1}`}
                                  </code>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">
                                      {code.isPublic ? 'Public' : 'Private'}
                                    </span>
                                    <Switch
                                      checked={code.isPublic}
                                      onCheckedChange={(checked) => handleVisibilityChange(code, checked)}
                                    />
                                  </div>
                                </div>
                              </div>
                              <CodeBlock code={code.content} />
                            </div>
                          </Card>
                        ))}
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setShowAddCodeDialog(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add New Code
                        </Button>
                      </div>
                    </TabsContent>
                    <TabsContent value="prompts" className="mt-4">
                      <div className="space-y-4">
                        {savedPrompts.map((prompt, index) => (
                          <Card key={prompt.id}>
                            <div className="p-6">
                              <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleDeletePrompt(prompt)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <h3 className="font-medium">Prompt {index + 1}</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                  <code className="text-sm text-muted-foreground">
                                    {prompt.isPublic ? prompt.chimPromptId : `prompt:${index + 1}`}
                                  </code>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">
                                      {prompt.isPublic ? 'Public' : 'Private'}
                                    </span>
                                    <Switch
                                      checked={prompt.isPublic}
                                      onCheckedChange={(checked) => handlePromptVisibilityChange(prompt, checked)}
                                    />
                                  </div>
                                </div>
                              </div>
                              <CodeBlock code={prompt.content} />
                            </div>
                          </Card>
                        ))}
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setShowAddPromptDialog(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add New Prompt
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
        <Dialog open={showAddCodeDialog} onOpenChange={setShowAddCodeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Paste your code here..."
                className="min-h-[200px] font-mono"
              />
              <Button onClick={handleSaveCode} disabled={createCodeMutation.isPending}>
                Save Code
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={showAddPromptDialog} onOpenChange={setShowAddPromptDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Prompt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
                className="min-h-[200px] font-mono"
              />
              <Button onClick={handleSavePrompt} disabled={createPromptMutation.isPending}>
                Save Prompt
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
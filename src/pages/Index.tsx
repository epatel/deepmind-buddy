import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Scissors, Upload, Sparkles, Download, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const HAIRSTYLES = [
  { id: "bob", label: "Bob Cut", emoji: "💇‍♀️" },
  { id: "curly", label: "Curly", emoji: "🌀" },
  { id: "pixie", label: "Pixie Cut", emoji: "✂️" },
  { id: "braids", label: "Braids", emoji: "🎀" },
  { id: "mohawk", label: "Mohawk", emoji: "🦅" },
  { id: "long-straight", label: "Long & Straight", emoji: "🪮" },
  { id: "afro", label: "Afro", emoji: "🌟" },
  { id: "buzz", label: "Buzz Cut", emoji: "⚡" },
];

const Index = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImage(ev.target?.result as string);
      setResultImage(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadedImage(ev.target?.result as string);
        setResultImage(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleTransform = async () => {
    if (!uploadedImage) {
      toast.error("Please upload a photo first");
      return;
    }
    if (!selectedStyle && !customPrompt.trim()) {
      toast.error("Select a hairstyle or describe one");
      return;
    }

    setIsProcessing(true);
    setResultImage(null);

    try {
      const { data, error } = await supabase.functions.invoke("change-hairstyle", {
        body: {
          imageBase64: uploadedImage,
          hairstyle: selectedStyle,
          customPrompt: customPrompt.trim() || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.image) {
        setResultImage(data.image);
        toast.success("Hairstyle transformed!");
      } else {
        throw new Error("No result image received");
      }
    } catch (err: any) {
      console.error("Transform error:", err);
      toast.error(err.message || "Failed to transform hairstyle");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const link = document.createElement("a");
    link.href = resultImage;
    link.download = `hairstyle-${selectedStyle || "custom"}-${Date.now()}.png`;
    link.click();
  };

  const handleReset = () => {
    setUploadedImage(null);
    setResultImage(null);
    setSelectedStyle(null);
    setCustomPrompt("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Scissors className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">HairSwap AI</h1>
            <p className="text-xs text-muted-foreground">Powered by Google AI</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Try a New Look <span className="inline-block">✨</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Upload your photo, pick a hairstyle, and let AI transform your look in seconds.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Upload + Controls */}
          <div className="space-y-6">
            {/* Upload Area */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {uploadedImage ? (
                  <div className="relative group">
                    <img
                      src={uploadedImage}
                      alt="Your photo"
                      className="w-full aspect-square object-cover"
                    />
                    <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Change Photo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="aspect-square flex flex-col items-center justify-center gap-4 cursor-pointer border-2 border-dashed border-border rounded-lg m-4 hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                      <Upload className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground">Drop your photo here</p>
                      <p className="text-sm text-muted-foreground">or click to browse</p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </CardContent>
            </Card>

            {/* Hairstyle Picker */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Choose a Style
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {HAIRSTYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => {
                      setSelectedStyle(style.id);
                      setCustomPrompt("");
                    }}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-sm ${
                      selectedStyle === style.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/30 bg-card"
                    }`}
                  >
                    <span className="text-xl">{style.emoji}</span>
                    <span className="text-xs font-medium text-foreground">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Or Describe It
              </h3>
              <Input
                placeholder="e.g. Wavy beach hair with blonde highlights"
                value={customPrompt}
                onChange={(e) => {
                  setCustomPrompt(e.target.value);
                  if (e.target.value) setSelectedStyle(null);
                }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                className="flex-1 h-12 text-base font-semibold"
                onClick={handleTransform}
                disabled={isProcessing || !uploadedImage || (!selectedStyle && !customPrompt.trim())}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Transforming…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Transform
                  </>
                )}
              </Button>
              {(uploadedImage || resultImage) && (
                <Button variant="outline" size="icon" className="h-12 w-12" onClick={handleReset}>
                  <RotateCcw className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>

          {/* Right: Result */}
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {resultImage ? (
                  <img
                    src={resultImage}
                    alt="Transformed hairstyle"
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="aspect-square flex flex-col items-center justify-center gap-4 bg-muted/30">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                      <Sparkles className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div className="text-center px-8">
                      <p className="font-medium text-foreground">Your new look appears here</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Upload a photo and pick a style to get started
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {resultImage && (
              <Button variant="outline" className="w-full" onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Download Result
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Scissors, Upload, Sparkles, Download, RotateCcw, Loader2, Camera, X, ImagePlus, QrCode, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import qrCodeImage from "@/assets/qr-code.png";
import { toast } from "sonner";

import hairstyleBob from "@/assets/hairstyle-bob.jpg";
import hairstyleCurly from "@/assets/hairstyle-curly.jpg";
import hairstylePixie from "@/assets/hairstyle-pixie.jpg";
import hairstyleBraids from "@/assets/hairstyle-braids.jpg";
import hairstyleMohawk from "@/assets/hairstyle-mohawk.jpg";
import hairstyleLongStraight from "@/assets/hairstyle-long-straight.jpg";
import hairstyleAfro from "@/assets/hairstyle-afro.jpg";
import hairstyleBuzz from "@/assets/hairstyle-buzz.jpg";
import hairstylePaskkarring from "@/assets/hairstyle-paskkarring.jpg";

const BASE_HAIRSTYLES = [
  { id: "bob", label: "Bob Cut", image: hairstyleBob },
  { id: "curly", label: "Curly", image: hairstyleCurly },
  { id: "pixie", label: "Pixie Cut", image: hairstylePixie },
  { id: "braids", label: "Braids", image: hairstyleBraids },
  { id: "mohawk", label: "Mohawk", image: hairstyleMohawk },
  { id: "long-straight", label: "Long & Straight", image: hairstyleLongStraight },
  { id: "afro", label: "Afro", image: hairstyleAfro },
  { id: "buzz", label: "Buzz Cut", image: hairstyleBuzz },
];

const SEASONAL_HAIRSTYLES = [
  {
    id: "paskkarring",
    label: "Påskkärring",
    image: hairstylePaskkarring,
    customPrompt: "Utklädnad: Huckle, förkläde, målade röda kinder och fräknar, samt kvast.",
    expiry: new Date("2026-04-07T00:00:00"), // available through April 6, 2026
  },
];

const now = new Date();
const HAIRSTYLES = [
  ...SEASONAL_HAIRSTYLES.filter((s) => now < s.expiry),
  ...BASE_HAIRSTYLES,
];

const HAIR_COLORS = [
  { id: "natural-black", label: "Natural Black", hex: "#1a1a1a" },
  { id: "dark-brown", label: "Dark Brown", hex: "#3b2314" },
  { id: "medium-brown", label: "Medium Brown", hex: "#6b3a2a" },
  { id: "light-brown", label: "Light Brown", hex: "#8b6340" },
  { id: "golden-blonde", label: "Golden Blonde", hex: "#c8a24e" },
  { id: "platinum-blonde", label: "Platinum Blonde", hex: "#e8d8b8" },
  { id: "strawberry-blonde", label: "Strawberry Blonde", hex: "#c47a4a" },
  { id: "auburn", label: "Auburn", hex: "#7a2e1a" },
  { id: "copper-red", label: "Copper Red", hex: "#b34222" },
  { id: "burgundy", label: "Burgundy", hex: "#6b1a3a" },
  { id: "silver-grey", label: "Silver Grey", hex: "#b0b0b0" },
  { id: "pastel-pink", label: "Pastel Pink", hex: "#e8a0b0" },
];

const COLOR_TECHNIQUES = [
  { id: "ombre", label: "Ombré", desc: "Dark roots fading to lighter ends" },
  { id: "balayage", label: "Balayage", desc: "Hand-painted natural highlights" },
  { id: "highlights", label: "Highlights", desc: "Lighter streaks throughout" },
  { id: "lowlights", label: "Lowlights", desc: "Darker streaks for depth" },
  { id: "streaks", label: "Streaks", desc: "Bold contrasting color streaks" },
  { id: "dip-dye", label: "Dip Dye", desc: "Vivid color on the ends only" },
  { id: "roots", label: "Shadow Roots", desc: "Dark roots blending into color" },
  { id: "money-piece", label: "Money Piece", desc: "Face-framing highlights" },
  { id: "split", label: "Split Dye", desc: "Two-tone half-and-half color" },
  { id: "peekaboo", label: "Peekaboo", desc: "Hidden color under top layer" },
];

const Index = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedTechnique, setSelectedTechnique] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1024 }, height: { ideal: 1024 } },
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      toast.error("Could not access camera. Please check permissions.");
    }
  }, []);

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsCameraOpen(false);
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setUploadedImage(dataUrl);
    setResultImage(null);
    closeCamera();
  }, [closeCamera]);

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
    if (!selectedStyle && !customPrompt.trim() && !referenceImage) {
      toast.error("Select a hairstyle, describe one, or add a reference image");
      return;
    }

    setIsProcessing(true);
    setResultImage(null);

    try {
      const selectedColorLabel = HAIR_COLORS.find((c) => c.id === selectedColor)?.label;
      const selectedTechniqueObj = COLOR_TECHNIQUES.find((t) => t.id === selectedTechnique);
      const { data, error } = await supabase.functions.invoke("change-hairstyle", {
        body: {
          imageBase64: uploadedImage,
          hairstyle: selectedStyle,
          hairColor: selectedColorLabel || undefined,
          colorTechnique: selectedTechniqueObj ? selectedTechniqueObj.label : undefined,
          referenceImage: referenceImage || undefined,
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
    setSelectedColor(null);
    setSelectedTechnique(null);
    setReferenceImage(null);
    setCustomPrompt("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (refImageInputRef.current) refImageInputRef.current.value = "";
  };

  const [showQr, setShowQr] = useState(false);
  const [backendDown, setBackendDown] = useState(false);

  useEffect(() => {
    supabase.functions
      .invoke("change-hairstyle", { body: { ping: true } })
      .catch(() => setBackendDown(true));
  }, []);

  if (backendDown) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
        <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Sorry, service not available</h1>
        <p className="text-muted-foreground max-w-md">
          Our backend is currently unreachable. Please try again later.
        </p>
      </div>
    );
  }

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
          <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setShowQr(true)}>
            <QrCode className="h-5 w-5" />
          </Button>
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

        {/* Upload Your Photo */}
        <div className="max-w-md mx-auto space-y-4">
           <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
             <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
             Upload Your Photo
           </h3>
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
                isCameraOpen ? (
                  <div className="aspect-square relative bg-black flex items-center justify-center">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      playsInline
                      muted
                    />
                    <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-4">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-12 w-12 rounded-full"
                        onClick={closeCamera}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                      <Button
                        className="h-16 w-16 rounded-full"
                        onClick={capturePhoto}
                      >
                        <Camera className="h-7 w-7" />
                      </Button>
                    </div>
                  </div>
                ) : (
                <div
                  className="aspect-square flex flex-col items-center justify-center gap-4 cursor-pointer border-2 border-dashed border-border rounded-lg m-4 hover:border-primary/50 transition-colors"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <Upload className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                     <p className="font-medium text-foreground text-lg">Drop your selfie here</p>
                     <p className="text-sm text-muted-foreground">This is the face that will be transformed</p>
                   </div>
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4" />
                      Upload
                    </Button>
                    <Button variant="outline" size="sm" onClick={openCamera}>
                      <Camera className="h-4 w-4" />
                      Take Photo
                    </Button>
                  </div>
                </div>
                )
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
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Choose a Style
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {HAIRSTYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => {
                  setSelectedStyle(style.id);
                  const seasonal = SEASONAL_HAIRSTYLES.find((s) => s.id === style.id);
                  setCustomPrompt(seasonal?.customPrompt ?? "");
                }}
                className={`group relative overflow-hidden rounded-xl border-2 transition-all ${
                  selectedStyle === style.id
                    ? "border-primary ring-2 ring-primary/20 shadow-md"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={style.image}
                    alt={style.label}
                    loading="lazy"
                    width={512}
                    height={512}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
                <div className={`absolute bottom-0 inset-x-0 px-2 py-2 text-center text-sm font-semibold transition-colors ${
                  selectedStyle === style.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/90 text-foreground backdrop-blur-sm"
                }`}>
                  {style.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Reference Image */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Or Copy a Style From a Photo <span className="text-muted-foreground font-normal normal-case">(optional)</span>
            </h3>
            {referenceImage && (
              <button
                onClick={() => { setReferenceImage(null); if (refImageInputRef.current) refImageInputRef.current.value = ""; }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Remove
              </button>
            )}
          </div>
          {referenceImage ? (
            <div className="flex items-start gap-4">
              <div className="relative w-32 h-32 rounded-xl overflow-hidden border-2 border-primary shrink-0">
                <img src={referenceImage} alt="Reference hairstyle" className="w-full h-full object-cover" />
                <button
                  onClick={() => { setReferenceImage(null); if (refImageInputRef.current) refImageInputRef.current.value = ""; }}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-foreground/70 text-background flex items-center justify-center hover:bg-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground pt-2">
                The AI will try to replicate this hairstyle on your photo.
              </p>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full h-12 gap-2"
              onClick={() => refImageInputRef.current?.click()}
            >
              <ImagePlus className="h-5 w-5" />
              Upload a Hairstyle Inspiration Photo
            </Button>
          )}
          <input
            ref={refImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                setReferenceImage(ev.target?.result as string);
                setSelectedStyle(null);
              };
              reader.readAsDataURL(file);
            }}
          />
        </div>


        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Hair Color <span className="text-muted-foreground font-normal normal-case">(optional)</span>
            </h3>
            {selectedColor && (
              <button
                onClick={() => setSelectedColor(null)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {HAIR_COLORS.map((color) => (
              <button
                key={color.id}
                onClick={() => setSelectedColor(selectedColor === color.id ? null : color.id)}
                className={`group flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all text-sm ${
                  selectedColor === color.id
                    ? "border-primary ring-2 ring-primary/20 shadow-sm"
                    : "border-border hover:border-primary/40"
                }`}
                title={color.label}
              >
                <span
                  className="h-5 w-5 rounded-full border border-border/50 shrink-0"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="font-medium text-foreground">{color.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Color Technique */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Coloring Technique <span className="text-muted-foreground font-normal normal-case">(optional)</span>
            </h3>
            {selectedTechnique && (
              <button
                onClick={() => setSelectedTechnique(null)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {COLOR_TECHNIQUES.map((tech) => (
              <button
                key={tech.id}
                onClick={() => setSelectedTechnique(selectedTechnique === tech.id ? null : tech.id)}
                className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${
                  selectedTechnique === tech.id
                    ? "border-primary ring-2 ring-primary/20 shadow-sm bg-primary/5"
                    : "border-border hover:border-primary/40 bg-card"
                }`}
              >
                <span className="text-sm font-semibold text-foreground">{tech.label}</span>
                <span className="text-xs text-muted-foreground leading-tight">{tech.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Prompt */}
        <div className="space-y-2 max-w-xl">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Or Describe Your Own
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
        <div className="flex gap-3 max-w-md mx-auto">
          <Button
            className="flex-1 h-12 text-base font-semibold"
            onClick={handleTransform}
            disabled={isProcessing || !uploadedImage || (!selectedStyle && !customPrompt.trim() && !referenceImage)}
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

        {/* Before & After */}
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Before</h3>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  {uploadedImage ? (
                    <img src={uploadedImage} alt="Original photo" className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="aspect-square flex items-center justify-center bg-muted/30">
                      <p className="text-sm text-muted-foreground">Your original photo</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">After</h3>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  {resultImage ? (
                    <img src={resultImage} alt="Transformed hairstyle" className="w-full aspect-square object-cover" />
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
            </div>
          </div>

          {resultImage && (
            <Button variant="outline" className="w-full" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download Result
            </Button>
          )}
        </div>
      </main>
      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent className="sm:max-w-xs flex flex-col items-center gap-4">
          <DialogTitle className="text-center text-foreground">Scan QR Code</DialogTitle>
          <img src={qrCodeImage} alt="QR Code" className="w-full max-w-[240px]" />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;

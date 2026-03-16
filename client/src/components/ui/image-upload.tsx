import { useState, useRef } from "react";
import { Button } from "./button";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  onRemove,
  disabled
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic client-side validation
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Hata",
        description: "Lütfen geçerli bir görsel dosyası seçin.",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Hata",
        description: "Görsel boyutu 5MB'dan küçük olmalıdır.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Yükleme başarısız');

      const data = await response.json();
      onChange(data.imageUrl);
      
      toast({
        title: "Başarılı",
        description: "Görsel yüklendi."
      });
    } catch (error) {
      toast({
        title: "Hata",
        description: "Görsel yüklenirken bir sorun oluştu.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4 w-full flex flex-col items-center justify-center">
      <div className="flex items-center gap-4">
        {value ? (
          <div className="relative w-[200px] h-[200px] rounded-md overflow-hidden border border-border">
            <div className="z-10 absolute top-2 right-2">
              <Button
                type="button"
                onClick={onRemove}
                variant="destructive"
                size="icon"
                className="h-8 w-8"
                disabled={disabled || isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <img
              className="object-cover w-full h-full"
              alt="Uploaded image"
              src={value}
            />
          </div>
        ) : (
          <div 
            onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
            className={`
              w-[200px] h-[200px] rounded-md border-2 border-dashed border-muted-foreground/25 
              flex flex-col items-center justify-center gap-2 cursor-pointer
              hover:bg-accent transition-colors
              ${(disabled || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {isUploading ? (
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            ) : (
              <>
                <ImagePlus className="h-10 w-10 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Görsel Yükle</span>
              </>
            )}
          </div>
        )}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        accept="image/*"
        className="hidden"
        disabled={disabled || isUploading}
      />
      <p className="text-xs text-muted-foreground">
        PNG, JPG veya WEBP. Maks 5MB.
      </p>
    </div>
  );
}

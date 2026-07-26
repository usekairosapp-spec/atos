"use client";

import Image from "next/image";
import { Camera, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

type AvatarPickerProps = { currentAvatarUrl: string | null };

export function AvatarPicker({ currentAvatarUrl }: AvatarPickerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const [fileLabel, setFileLabel] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropArea, setCropArea] = useState<Area | null>(null);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCropArea(areaPixels);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      event.target.value = "";
      setError("Escolha uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      event.target.value = "";
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setFileLabel(`${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setIsEditing(true);
  }

  return (
    <div>
      {isEditing && previewUrl ? (
        <div className="mb-5 rounded-2xl bg-[#112e3b] p-4">
          <p className="mb-3 text-sm font-medium text-white">Arraste a foto para centralizar o rosto</p>
          <div className="relative h-72 overflow-hidden rounded-xl sm:h-80">
            <Cropper image={previewUrl} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={handleCropComplete} />
          </div>
          <label className="mt-4 flex items-center gap-3 text-sm font-medium text-white">Zoom
            <input className="w-full accent-[#6ea8e8]" type="range" min={1} max={3} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
          </label>
        </div>
      ) : null}
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <div className="relative h-28 w-28 overflow-hidden rounded-full bg-blue-100 text-[#277ad8] ring-4 ring-white shadow-md">
          {previewUrl ? <Image className="object-cover" src={previewUrl} alt="Prévia da foto de perfil" fill sizes="112px" unoptimized priority /> : <span className="grid h-full w-full place-items-center"><Camera size={36} /></span>}
        </div>
        <div>
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-[#d7dee5] px-4 py-3 font-semibold text-[#277ad8] hover:bg-blue-50">
            <RefreshCw size={18} /> {previewUrl ? "Trocar foto" : "Escolher foto"}
            <input className="sr-only" type="file" name="avatar" accept="image/jpeg,image/png,image/webp" onChange={handleFile} />
          </label>
          {fileLabel ? <p className="mt-2 max-w-xs truncate text-sm text-[#6b767d]">{fileLabel}</p> : null}
        </div>
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-red-700" role="alert">{error}</p> : null}
      <input type="hidden" name="cropX" value={cropArea?.x ?? ""} />
      <input type="hidden" name="cropY" value={cropArea?.y ?? ""} />
      <input type="hidden" name="cropWidth" value={cropArea?.width ?? ""} />
      <input type="hidden" name="cropHeight" value={cropArea?.height ?? ""} />
      <p className="mt-3 text-sm text-[#6b767d]">JPG, PNG ou WebP, até 5 MB. Arraste e aplique zoom antes de salvar.</p>
    </div>
  );
}

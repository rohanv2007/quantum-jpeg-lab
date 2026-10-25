import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ImageIcon, Loader2, Play, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { PixelCanvas } from "@/components/qj/primitives";
import { fmtEps, orderingLabel, type Chi, type Ordering } from "@/lib/data";
import { imageFromFile, sampleImage, type Img } from "@/lib/imagery";
import { runLocalBenchmark, saveLocalResult, type LocalResult } from "@/lib/local-bench";

export interface TestTarget { key: string; qubits: 8 | 10; eps: number; ordering: Ordering; chi: Chi }

const STAGES = ["Load & sample image", "Order pixels & normalize amplitudes", "Right-canonical MPS truncation", "Sequential isometry synthesis", "Transpile to rz·sx·x·cx", "Noisy fidelity evaluation"];

export function RunTestDialog({ target, onClose }: { target: TestTarget | null; onClose: () => void }) {
  const [img, setImg] = useState<Img | null>(null);
  const [name, setName] = useState("Sample camera tile");
  const [stage, setStage] = useState(-1);
  const [result, setResult] = useState<LocalResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const size = target?.qubits === 8 ? 16 : 32;

  useEffect(() => {
    if (!target) return;
    setImg(sampleImage(target.qubits === 8 ? 16 : 32));
    setName("Sample camera tile");
    setStage(-1);
    setResult(null);
  }, [target]);

  const onFile = async (f?: File) => {
    if (!f) return;
    try { setImg(await imageFromFile(f, size, false)); setName(f.name); }
    catch { toast.error("Could not read that image. Try a PNG or JPG."); }
  };

  const run = async () => {
    if (!target || !img) return;
    setResult(null);
    for (let i = 0; i < STAGES.length; i++) { setStage(i); await new Promise((r) => setTimeout(r, 450)); }
    const r = runLocalBenchmark(img, target.qubits, target.eps, target.ordering, target.chi, target.key, name);
    saveLocalResult(r);
    setStage(STAGES.length);
    setResult(r);
    toast.success("Test complete — results added to the table");
  };

  const running = stage >= 0 && stage < STAGES.length;

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !running && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Run benchmark test</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {target && `${target.qubits} qubits (${size}×${size}) · εcx ${fmtEps(target.eps)} · ${orderingLabel(target.ordering)} · χ=${target.chi}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          <div className="space-y-2">
            <div className="overflow-hidden rounded-xl border bg-muted">{img ? <PixelCanvas img={img} className="aspect-square w-full" /> : <div className="flex aspect-square items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>}</div>
            <p className="truncate text-[11px] text-muted-foreground">{name}</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5" disabled={running} onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Upload</Button>
              <Button size="sm" variant="ghost" disabled={running} onClick={() => { setImg(sampleImage(size)); setName("Sample camera tile"); }}>Sample</Button>
            </div>
          </div>

          <div className="space-y-3">
            <ol className="space-y-1.5 text-xs">
              {STAGES.map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  {stage > i ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : stage === i ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <span className="h-3.5 w-3.5 rounded-full border" />}
                  <span className={stage >= i ? "text-foreground" : "text-muted-foreground"}>{s}</span>
                </li>
              ))}
            </ol>
            {stage >= 0 && <Progress value={(Math.min(stage, STAGES.length) / STAGES.length) * 100} className="h-1.5" />}

            {result && (
              <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-3 font-mono text-xs">
                <div><p className="text-muted-foreground">MPS fidelity</p><p className="text-base font-semibold text-primary">{result.mps.fidelity.toFixed(4)}</p><p className="text-muted-foreground">{result.mps.cnots} CNOTs</p></div>
                <div><p className="text-muted-foreground">Exact fidelity</p><p className="text-base font-semibold">{result.exact.fidelity.toFixed(4)}</p><p className="text-muted-foreground">{result.exact.cnots} CNOTs</p></div>
                <p className="col-span-2 text-[11px] text-muted-foreground">Ideal (noiseless) MPS fidelity {result.idealFidelity.toFixed(4)} · computed in your browser</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={running} onClick={onClose}>{result ? "Done" : "Cancel"}</Button>
          <Button className="gap-1.5" disabled={!img || running} onClick={run}>{running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}{result ? "Run again" : "Run test"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

# ai/

Model storage and training entry points for the deployed product.

**The actual training pipeline lives in the separate SinAI-Training repo** —
`work/sinllama/` has the download/merge scripts, per-task LoRA training
(`scripts/train_*.py`), evaluation (`scripts/test_*.py`), and the inference
server (`serve_sinllama.py`) that `apps/backend-api` talks to.

Layout here:

```
models/
├── sinllama/          SinLLaMA merged base + extended tokenizer (gitignored)
└── fine_tuned/        Task LoRA adapters (gitignored)
training/              Reserved for productionised training entry points;
                       train_grammer.py / train_summarizer.py are placeholders
                       until the SinAI-Training scripts are promoted here.
```

Model weights are never committed — pull them with
`SinAI-Training/work/sinllama/download_model.py` or copy from the GPU box.

# `serve_sinai.py` — per-tool adapter override

Apply this on the GPU box (SinAI-Training repo). Three edits, ~30 lines.

Until it is applied, the backend keeps working exactly as before: it only
sends the `adapter` field when an admin has set one, and falls back to the
task default if the server rejects it.

---

## 1. Add `adapter` to `PromptRequest`

```python
class PromptRequest(BaseModel):
    prompt : str
    task   : str            = "grammar"
    style  : Optional[str] = None
    length : Optional[str] = None
    # Specific adapter folder to run instead of the task's default, e.g.
    # "grammar_sinllama_v13". Must belong to the same task category as
    # `task` — see the guard in /generate. Omit to use the latest adapter
    # find_latest_adapters() resolved at startup.
    adapter: Optional[str] = None
```

## 2. Add a resolver next to `run_generation`

The load-on-demand block is lifted from `/compare`, which already does this.

```python
def resolve_adapter(task: str, adapter: Optional[str]) -> str:
    """
    Which PEFT adapter to activate for a request.

    Returns the generic task name when no override is given — that is the
    alias registered at startup for whatever find_latest_adapters() picked.
    With an override, validates it and loads it on demand.
    """
    if not adapter:
        return task

    discovered = discover_adapters()
    if adapter not in discovered:
        raise HTTPException(
            status_code=422,
            detail={
                "error": f"Unknown adapter '{adapter}'.",
                "available": sorted(
                    n for n in discovered if get_adapter_category(n) == task
                ),
            },
        )

    # A headline adapter behind a grammar prompt produces plausible-looking
    # nonsense rather than an error, so the mismatch has to be refused here.
    category = get_adapter_category(adapter)
    if category != task:
        raise HTTPException(
            status_code=422,
            detail={
                "error": f"Adapter '{adapter}' is a {category} adapter, "
                         f"but the task is '{task}'.",
                "available": sorted(
                    n for n in discovered if get_adapter_category(n) == task
                ),
            },
        )

    if adapter not in LOADED_ADAPTERS:
        print(f"[INFO] Loading adapter on-the-fly for /generate: {adapter}")
        with _generation_lock:
            model.load_adapter(discovered[adapter], adapter_name=adapter)
            LOADED_ADAPTERS.add(adapter)

    return adapter
```

## 3. Use it in `/generate`

```python
    active_adapter = resolve_adapter(req.task, req.adapter)

    gen = run_generation(
        req.task, req.prompt, req.style,
        active_adapter=active_adapter, length=req.length,
    )

    return {
        "response"      : gen["text"] if gen["text"] and len(gen["text"]) >= 2 else req.prompt,
        "task"          : req.task,
        "adapter"       : active_adapter,   # echo what actually ran
        "style"         : req.style if req.task == "style" else None,
        "length"        : gen.get("length_used") if req.task in ("summarizer", "headline") else None,
        "input_tokens"  : gen["prompt_len"],
        "max_cap_used"  : gen["max_new_tokens"],
        "output_tokens" : gen["output_tokens"],
    }
```

---

## Why nothing else needs changing

- `run_generation()` already accepts an arbitrary `active_adapter` — that is
  how `/compare` runs any adapter today.
- `_summarizer_adapter_folder_name()` already handles both forms: the generic
  `"summarizer"` alias resolves through `ADAPTER_PATHS`, while a specific
  folder name is used as-is. So v06+ length-conditioning stays correct when
  an override is set.
- `_generation_lock` already guards `set_adapter()` + `generate()`, and the
  on-demand load takes the same lock.

## Worth knowing

`LOADED_ADAPTERS` never shrinks, so each distinct adapter selected stays
resident in VRAM. That is bounded by the number of adapter folders and LoRA
weights are small, but it is the reason to prefer selecting a few adapters
rather than cycling through all of them.

## Verify after applying

```bash
curl -s localhost:8000/generate -H 'Content-Type: application/json' \
  -d '{"prompt":"ළමයි පාසලට යනවා.","task":"grammar","adapter":"grammar_sinllama_v13"}' | jq .adapter

# Mismatch must be refused:
curl -s -o /dev/null -w '%{http_code}\n' localhost:8000/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"x","task":"grammar","adapter":"headline_sinllama_v17"}'
# expect 422
```

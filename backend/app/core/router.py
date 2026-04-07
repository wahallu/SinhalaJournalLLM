from app.services.grammar.grammar_service import grammar_check
from app.services.headline.headline_service import generate_headline
from app.services.summarizer.summarizer_service import summarize_text
from app.services.style.style_service import rewrite_style

def task_router(task: str, text: str):

    if task == "grammar":
        return grammar_check(text)

    elif task == "headline":
        return generate_headline(text)

    elif task == "summarize":
        return summarize_text(text)

    elif task == "style":
        return rewrite_style(text)

    else:
        return "Invalid task"
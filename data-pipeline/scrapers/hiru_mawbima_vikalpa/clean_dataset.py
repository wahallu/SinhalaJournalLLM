import json
import re

def clean_text(text):
    if not text:
        return text
    
    # 1. Remove all English letters (this automatically removes English words)
    text = re.sub(r'[a-zA-Z]', '', text)
    
    # 2. Remove forward slashes (/)
    text = re.sub(r'/', '', text)
    
    # 3. Remove extra white spaces and strip leading/trailing spaces
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

# Define file paths
input_file = r'd:\SinhalaLLM\webscraper\output\mawbima_corpus.json'
output_file = r'd:\SinhalaLLM\webscraper\output\mawbima_corpus_cleaned.json'

print("Loading dataset...")
with open(input_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Cleaning dataset...")
# Loop through the dataset and clean only the 'title' and 'content' fields
for item in data:
    if 'title' in item and isinstance(item['title'], str):
        item['title'] = clean_text(item['title'])
        
    if 'content' in item and isinstance(item['content'], str):
        item['content'] = clean_text(item['content'])

print("Saving cleaned dataset...")
# Save the cleaned dataset to a new file
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)

print(f"Done! Cleaned dataset saved to: {output_file}")

import json
import os

def extract_categories(file_path, file_label):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return

    output_lines = []
    output_lines.append(f"\n--- Processing {file_label} ({len(data)} records) ---")
    
    categories = set()
    keys_seen = set()
    
    for item in data:
        # Check for unified_category or unified_categories
        val = item.get('unified_category') or item.get('unified_categories')
        if val:
            if isinstance(val, list):
                for v in val:
                    categories.add(v)
            else:
                categories.add(val)
        
        # Collect all keys just in case we miss it
        keys_seen.update(item.keys())

    if categories:
        output_lines.append(f"Unique Unified Categories found in {file_label}:")
        for cat in sorted(categories):
            output_lines.append(f" - {cat}")
    else:
        output_lines.append(f"No 'unified_category' or 'unified_categories' key found with values in {file_label}.")
        output_lines.append(f"Available keys in first record: {list(keys_seen)[:10]}...")

    with open('categories.txt', 'a', encoding='utf-8') as outfile:
        outfile.write('\n'.join(output_lines) + '\n')
    
    # Also print to stdout
    print('\n'.join(output_lines))

def main():
    # Clear file first
    with open('categories.txt', 'w', encoding='utf-8') as f:
        f.write("Extracted Categories:\n")

    base_dir = r'd:\SinhalaLLM\webscraper\output'
    hiru_path = os.path.join(base_dir, 'hirunews_corpus.json')
    vikalpa_path = os.path.join(base_dir, 'vikalpa_corpus.json')

    extract_categories(hiru_path, "Hiru News")
    extract_categories(vikalpa_path, "Vikalpa")

if __name__ == "__main__":
    main()

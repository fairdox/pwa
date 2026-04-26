import requests
import json

def generate_sql_file():
    # The master database file from the chords-db project
    GITHUB_JSON_URL = 'https://raw.githubusercontent.com/tombatossals/chords-db/master/lib/guitar.json'
    
    print("Downloading chord database...")
    try:
        response = requests.get(GITHUB_JSON_URL)
        response.raise_for_status()
        db = response.json()
        
        sql_statements = []
        
        # 1. Table Creation
        sql_statements.append("-- 1. Create table")
        sql_statements.append("CREATE TABLE IF NOT EXISTS guitar_chords (")
        sql_statements.append("    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,")
        sql_statements.append("    key text NOT NULL,")
        sql_statements.append("    suffix text NOT NULL,")
        sql_statements.append("    positions jsonb NOT NULL,")
        sql_statements.append("    created_at timestamptz DEFAULT now()")
        sql_statements.append(");")
        sql_statements.append("")
        
        # 2. Add an index for performance
        sql_statements.append("-- 2. Add index for faster searching")
        sql_statements.append("CREATE INDEX IF NOT EXISTS idx_chords_lookup ON guitar_chords (key, suffix);")
        sql_statements.append("")

        # 3. Generate Inserts
        print("Processing chords...")
        for key, suffixes in db['chords'].items():
            for chord in suffixes:
                # Escape single quotes for SQL safety
                safe_key = key.replace("'", "''")
                safe_suffix = chord['suffix'].replace("'", "''")
                
                # Convert the positions array to a JSON string and escape single quotes
                positions_str = json.dumps(chord['positions']).replace("'", "''")
                
                stmt = f"INSERT INTO guitar_chords (key, suffix, positions) VALUES ('{safe_key}', '{safe_suffix}', '{positions_str}');"
                sql_statements.append(stmt)
        
        # Save to file
        output_file = 'import_guitar_chords.sql'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(sql_statements))
            
        print(f"Success! Created {output_file} with {len(sql_statements) - 5} chords.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    generate_sql_file()
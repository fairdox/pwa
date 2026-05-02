// db.js

const { createClient } = supabase;

// Replace these with your actual Supabase credentials
const SUPABASE_URL = 'https://cojemwhawiaxqulwcvvn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_z6cp3z8yMOYF9ousrJHV4g_x2_fYZEh';

const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Database Service Object
 * Encapsulates all CRUD operations for the Guitar App
 */
const dbService = {
  _theoryCacheKey: 'fretboard_theory_defs',
  _chordCache: new Map(), // In-memory cache for voicings (key + suffix)
  _intervalMap: {
            "1": 0, "b2": 1, "2": 2, "#2": 3, "b3": 3, "3": 4, "4": 5,
            "#4": 6, "b5": 6, "5": 7, "#5": 8, "b6": 8, "6": 9, "bb7": 9,
            "b7": 10, "7": 11, "b9": 13, "9": 14, "#9": 15, "11": 17,
            "#11": 18, "13": 21
        },
  // --- AUTHENTICATION ---
  async signIn() {
    const { error } = await _supabase.auth.signInWithOAuth({
      provider: 'github',
    });
    if (error) console.error('Login error:', error.message);
  },

  async signOut() {
    await _supabase.auth.signOut();
  },

  async getUser() {
    const { data: { user } } = await _supabase.auth.getUser();
    return user;
  },

  // --- CHORD OPERATIONS ---
  async saveChord(chordName, fingeringData) {
    const user = await this.getUser();
    const { data, error } = await _supabase
      .from('chords')
      .insert([{ 
        name: chordName, 
        fingering: fingeringData, 
        user_id: user?.id 
      }]);
    
    if (error) throw error;
    return data;
  },

  clearLocalSorage() {
    localStorage.removeItem(this._theoryCacheKey);
    this._chordCache.clear();
  },

  processDefinitions(data) {
      return data.map(item => ({
          label: item.label,
          suffix: item.suffix,
          quality: item.quality,
          formula: item.formula,
          variants: item.variants,
          group: item.group,
          semitones: item.formula.map(interval => this._intervalMap[interval] || 0)
      }));
  },
  /**
   * 1. Load Theory (Formulas)
   * Strategy: LocalStorage (Persistence across reloads)
   */
  async getTheoryDefinitions(force=false) {
      const localData = localStorage.getItem(this._theoryCacheKey);
      if (localData && !force) return JSON.parse(localData);

      const { data, error } = await _supabase
          .from('chord_definitions')
          .select('*')
          .order('group', { ascending: true });          

      if (error) throw error;

      const processedData = this.processDefinitions(data);
      localStorage.setItem(this._theoryCacheKey, JSON.stringify(processedData));
      return processedData;
  },

  /**
   * 2. Load Specific Chord Voicings
   * Strategy: In-memory Map (Performance during session)
   */
  async getChordVoicings(key, suffix) {
      const cacheKey = `${key}-${suffix}`;
      
      // Return from memory if already fetched this session
      if (this._chordCache.has(cacheKey)) {
          return this._chordCache.get(cacheKey);
      }

      const { data, error } = await _supabase
          .from('guitar_chords')
          .select('positions')
          .eq('key', key)
          .eq('suffix', suffix)
          .single();

      if (error) {
          console.warn(`No voicings found for ${key}${suffix}`);
          return null;
      }

      // Cache and return
      this._chordCache.set(cacheKey, data.positions);
      return data.positions;
  },

  /**
   * 3. Utility: Get Everything for a specific Chord
   */
  async getFullChordData(key, suffix) {
      const theory = await this.getTheoryDefinitions();
      const formula = theory.find(t => t.suffix === suffix);
      const voicings = await this.getChordVoicings(key, suffix);

      return {
          key,
          suffix,
          formula: formula ? formula.formula : [],
          quality: formula ? formula.quality : 'unknown',
          voicings: voicings || []
      };
  },

  // --- SONG OPERATIONS ---
  async saveSong(title, chordIds) {
    const user = await this.getUser();
    const { data, error } = await _supabase
      .from('songs')
      .insert([{ 
        title: title, 
        chord_list: chordIds, 
        user_id: user?.id 
      }]);

    if (error) throw error;
    return data;
  }
};
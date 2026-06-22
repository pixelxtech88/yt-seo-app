import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('analyzer');

  // Video Analyzer States
  const [url, setUrl] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [gapLoading, setGapLoading] = useState(false);
  const [gapResult, setGapResult] = useState(null);

  // Keyword Checker States
  const [keyword, setKeyword] = useState('');
  const [kwLoading, setKwLoading] = useState(false);
  const [kwResults, setKwResults] = useState(null);

  // Tag Generator States
  const [tagInput, setTagInput] = useState('');
  const [tagLoading, setTagLoading] = useState(false);
  const [generatedTags, setGeneratedTags] = useState([]);
  const [copySuccess, setCopySuccess] = useState(false);

  // SEO Grader States
  const [gradeTitle, setGradeTitle] = useState('');
  const [gradeDesc, setGradeDesc] = useState('');
  const [gradeKeyword, setGradeKeyword] = useState('');
  const [gradeLoading, setGradeLoading] = useState(false);
  const [gradeResults, setGradeResults] = useState(null);

  const [error, setError] = useState(null);

  // --- FUNCTIONS ---
  const handleAnalyze = async (e) => {
    e.preventDefault(); setLoading(true); setError(null); setResults(null); setAiResult(null); setGapResult(null);
    try { const r = await axios.post('https://yt-seo-backend.onrender.com/api/analyze', { url }); setResults(r.data); } 
    catch (err) { setError(err.response?.data?.error || 'Error.'); } finally { setLoading(false); }
  };

  const handleGenerateAI = async () => {
    setAiLoading(true); setAiResult(null);
    try { const r = await axios.post('https://yt-seo-backend.onrender.com/api/generate', { keywords: results.keywords, originalTitle: results.title }); setAiResult(r.data.generatedText); } 
    catch (err) { setError(err.response?.data?.error || 'Error.'); } finally { setAiLoading(false); }
  };

  const handleFindGaps = async () => {
    setGapLoading(true); setGapResult(null);
    try { 
      const r = await axios.post('https://yt-seo-backend.onrender.com/api/find-gaps', { 
        keywords: results.keywords, 
        originalTitle: results.title,
        description: results.description
      }); 
      setGapResult(r.data.ideasText); 
    } catch (err) { setError(err.response?.data?.error || 'Error.'); } finally { setGapLoading(false); }
  };

  const handleKeywordCheck = async (e) => {
    e.preventDefault(); setKwLoading(true); setError(null); setKwResults(null);
    try { const r = await axios.post('https://yt-seo-backend.onrender.com/api/check-keyword', { keyword }); setKwResults(r.data); } 
    catch (err) { setError(err.response?.data?.error || 'Error.'); } finally { setKwLoading(false); }
  };

  const handleTagGenerate = async (e) => {
    e.preventDefault(); setTagLoading(true); setError(null); setGeneratedTags([]); setCopySuccess(false);
    try { const r = await axios.post('https://yt-seo-backend.onrender.com/api/generate-tags', { title: tagInput, keyword: tagInput }); setGeneratedTags(r.data.tags); } 
    catch (err) { setError(err.response?.data?.error || 'Error.'); } finally { setTagLoading(false); }
  };

  const handleGrade = async (e) => {
    e.preventDefault(); setGradeLoading(true); setError(null); setGradeResults(null);
    try { const r = await axios.post('https://yt-seo-backend.onrender.com/api/grade', { title: gradeTitle, description: gradeDesc, targetKeyword: gradeKeyword }); setGradeResults(r.data); } 
    catch (err) { setError(err.response?.data?.error || 'Error.'); } finally { setGradeLoading(false); }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedTags.join(', '));
    setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000);
  };

  const formatNumber = (num) => { if (!num) return 'N/A'; return Number(num).toLocaleString(); };
  const renderAiText = (text) => { return text.split('\n').map((line, i) => <span key={i}>{line}<br /></span>); };
  const getScoreColor = (score) => { if (score >= 75) return 'green'; if (score >= 50) return 'orange'; return 'red'; };

  return (
    <div className="container">
      <h1>YT SEO Pro <span className="badge">FINAL</span></h1>
      
      <div className="tabs">
        <button onClick={() => setActiveTab('analyzer')} className={`tab ${activeTab === 'analyzer' ? 'active' : ''}`}>Video Analyzer</button>
        <button onClick={() => setActiveTab('keyword')} className={`tab ${activeTab === 'keyword' ? 'active' : ''}`}>Keyword Checker</button>
        <button onClick={() => setActiveTab('tags')} className={`tab ${activeTab === 'tags' ? 'active' : ''}`}>Tag Generator</button>
        <button onClick={() => setActiveTab('grader')} className={`tab ${activeTab === 'grader' ? 'active' : ''}`}>SEO Grader</button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* TAB 1: VIDEO ANALYZER */}
      {activeTab === 'analyzer' && (
        <>
          <form onSubmit={handleAnalyze} className="search-box">
            <input type="text" placeholder="Paste a YouTube URL here..." value={url} onChange={(e) => setUrl(e.target.value)} required disabled={loading} />
            <button type="submit" disabled={loading}>{loading ? 'Analyzing...' : 'Analyze'}</button>
          </form>
          {results && (
            <div className="results-grid">
              <div className="card">
                <img src={results.thumbnails.high?.url} alt="Thumbnail" className="thumbnail" />
                <h2>{results.title}</h2>
                <p className="channel">By: {results.channelTitle}</p>
                <div className="stats-row">
                  <div className="stat"><strong>{formatNumber(results.stats.views)}</strong><span>Views</span></div>
                  <div className="stat"><strong>{formatNumber(results.stats.likes)}</strong><span>Likes</span></div>
                  <div className="stat"><strong>{formatNumber(results.stats.comments)}</strong><span>Comments</span></div>
                </div>
                
                <button onClick={handleGenerateAI} disabled={aiLoading} className="ai-btn" style={{marginBottom: '15px'}}>{aiLoading ? 'Generating...' : '🪄 Generate AI Title & Desc'}</button>
                {aiResult && (<div className="ai-results-box" style={{marginBottom: '20px'}}><h4>AI Generated Copy:</h4><div className="ai-text">{renderAiText(aiResult)}</div></div>)}

                <button onClick={handleFindGaps} disabled={gapLoading} className="gap-btn">{gapLoading ? 'Finding Gaps...' : '💡 Find Content Gaps (Steal Views)'}</button>
                {gapResult && (
                  <div className="gap-results-box">
                    <h4>Video Ideas They Missed:</h4>
                    <div className="ai-text gap-text">{renderAiText(gapResult)}</div>
                  </div>
                )}
              </div>
              
              <div className="card seo-data">
                <h3>SEO Extracted Data</h3>
                <div className="data-section"><h4>Description Preview</h4><p className="description-text">{results.description ? results.description.substring(0, 300) + '...' : 'No description.'}</p></div>
                <div className="data-section"><h4>Hidden Tags</h4><div className="tags-container">{results.tags.length > 0 ? results.tags.map((tag, i) => <span key={i} className="tag">{tag}</span>) : <p className="muted">Hidden.</p>}</div></div>
                <div className="data-section">
                  <h4>Extracted SEO Phrases</h4>
                  <div className="keywords-group"><span className="label">2-Word:</span>{results.keywords.bigrams.map((item, i) => <span key={i} className="keyword-chip">{item.phrase} <strong>({item.count})</strong></span>)}</div>
                  <div className="keywords-group" style={{ marginTop: '10px' }}><span className="label">3-Word:</span>{results.keywords.trigrams.map((item, i) => <span key={i} className="keyword-chip">{item.phrase} <strong>({item.count})</strong></span>)}</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: KEYWORD CHECKER */}
      {activeTab === 'keyword' && (
        <>
          <p className="subtitle">Find out if a topic has too much competition.</p>
          <form onSubmit={handleKeywordCheck} className="search-box">
            <input type="text" placeholder="Enter a keyword (e.g., Best Camping Tents)" value={keyword} onChange={(e) => setKeyword(e.target.value)} required disabled={kwLoading} />
            <button type="submit" disabled={kwLoading}>{kwLoading ? 'Checking...' : 'Check Keyword'}</button>
          </form>
          {kwResults && (
            <div className="card kw-results-card">
              <div className="kw-header">
                <h2>"{kwResults.keyword}"</h2>
                <div className={`competition-badge ${kwResults.competitionColor}`}>{kwResults.competitionLevel} Competition</div>
              </div>
              <p className="kw-avg">Avg views of top 5: <strong>{formatNumber(kwResults.avgViews)}</strong></p>
              <div className="kw-list">
                {kwResults.topVideos.map((video, i) => (
                  <div key={i} className="kw-item">
                    <span className="kw-rank">#{i + 1}</span>
                    <div className="kw-info"><p className="kw-title">{video.title}</p><p className="kw-channel">{video.channel}</p></div>
                    <div className="kw-views">{formatNumber(video.views)} views</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 3: TAG GENERATOR */}
      {activeTab === 'tags' && (
        <>
          <p className="subtitle">Generate tags and copy them to YouTube Studio.</p>
          <form onSubmit={handleTagGenerate} className="search-box">
            <input type="text" placeholder="Enter your video title or keyword..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} required disabled={tagLoading} />
            <button type="submit" disabled={tagLoading}>{tagLoading ? 'Generating...' : 'Generate Tags'}</button>
          </form>
          {generatedTags.length > 0 && (
            <div className="card tag-card">
              <div className="tag-card-header">
                <h3>Generated Tags ({generatedTags.length})</h3>
                <button onClick={copyToClipboard} className="copy-btn">{copySuccess ? '✅ Copied!' : '📋 Copy All'}</button>
              </div>
              <div className="generated-tags-container">
                {generatedTags.map((tag, i) => (<span key={i} className="gen-tag">{tag}</span>))}
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 4: SEO GRADER */}
      {activeTab === 'grader' && (
        <>
          <p className="subtitle">Paste your planned title and description to get an instant SEO score.</p>
          <div className="grader-form">
            <input type="text" placeholder="Target Keyword (e.g., iPhone 16 Review)" value={gradeKeyword} onChange={(e) => setGradeKeyword(e.target.value)} className="grader-input" />
            <textarea placeholder="Your YouTube Title..." value={gradeTitle} onChange={(e) => setGradeTitle(e.target.value)} rows="2" className="grader-input"></textarea>
            <textarea placeholder="Your YouTube Description..." value={gradeDesc} onChange={(e) => setGradeDesc(e.target.value)} rows="6" className="grader-input"></textarea>
            <button onClick={handleGrade} disabled={gradeLoading || !gradeTitle || !gradeDesc || !gradeKeyword} className="ai-btn">
              {gradeLoading ? 'Grading...' : '📝 Grade My SEO'}
            </button>
          </div>
          {gradeResults && (
            <div className="card grade-results-card">
              <div className="score-circle-container">
                <div className={`score-circle ${getScoreColor(gradeResults.score)}`}>
                  <span className="score-number">{gradeResults.score}</span>
                  <span className="score-label">/100</span>
                </div>
              </div>
              <div className="feedback-list">
                {gradeResults.feedback.map((item, index) => (
                  <div key={index} className={`feedback-item ${item.type}`}>
                    <span className="icon">{item.type === 'good' ? '✅' : item.type === 'okay' ? '⚠️' : '❌'}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
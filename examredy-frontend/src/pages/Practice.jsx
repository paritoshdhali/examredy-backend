import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import MCQSession from '../components/MCQSession';
import PrimePopup from '../components/PrimePopup';
import AdSlot from '../components/AdSlot';

const Practice = () => {
    const [searchParams] = useSearchParams();
    const initialCatId = searchParams.get('cat');
    const navigate = useNavigate();

    // UI States
    const [mode, setMode] = useState(null); // 'solo' | 'group'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPopup, setShowPopup] = useState(false);
    const [language, setLanguage] = useState('English');
    const [sessionInfo, setSessionInfo] = useState(null);

    // Global Data States
    const [categories, setCategories] = useState([]);
    const [states, setStates] = useState([]);

    // Flow Type
    const [flowType, setFlowType] = useState('competitive'); // 'school' | 'university' | 'competitive'

    // School Data States
    const [boards, setBoards] = useState([]);
    const [classes, setClasses] = useState([]);
    const [streams, setStreams] = useState([]);

    // University Data States
    const [universities, setUniversities] = useState([]);
    const [degreeTypes, setDegreeTypes] = useState([]);

    // Competitive Data States
    const [papersStages, setPapersStages] = useState([]);

    // Common Target States
    const [subjects, setSubjects] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [questions, setQuestions] = useState([]);

    // Selection States
    const [selectedCat, setSelectedCat] = useState(initialCatId || '');

    // Common / Flow-specific Selection
    const [selectedState, setSelectedState] = useState('');
    const [selectedBoard, setSelectedBoard] = useState('');
    const [selectedUniversity, setSelectedUniversity] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedStream, setSelectedStream] = useState('');
    const [selectedDegreeType, setSelectedDegreeType] = useState('');
    const [selectedPaperStage, setSelectedPaperStage] = useState('');

    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedChapter, setSelectedChapter] = useState('');

    // User AI Fetch State
    const [isFetchingAI, setIsFetchingAI] = useState('');

    // Flow Detection
    useEffect(() => {
        if (!selectedCat || categories.length === 0) return;
        const cat = categories.find(c => String(c.id) === String(selectedCat));
        if (!cat) return;

        const name = cat.name.toLowerCase();
        if (name.includes('school')) setFlowType('school');
        else if (name.includes('university') || name.includes('college')) setFlowType('university');
        else setFlowType('competitive');

        // Reset lower cascade when category changes to prevent invalid state
        setSelectedState('');
        setSelectedBoard('');
        setSelectedUniversity('');
        setSelectedClass('');
        setSelectedStream('');
        setSelectedDegreeType('');
        setSelectedPaperStage('');
        setSelectedSubject('');
        setSelectedChapter('');
    }, [selectedCat, categories]);

    // Initial Load
    useEffect(() => {
        const loadInitial = async () => {
            try {
                const [catRes, stateRes] = await Promise.all([
                    api.get('/structure/categories'),
                    api.get('/structure/states'),
                ]);
                setCategories(catRes.data);
                setStates(stateRes.data);
            } catch (err) {
                console.error('Failed to load initial data', err);
            }
        };
        loadInitial();
    }, []);

    // ── DATA CASCADE LOGIC ──

    // State changes -> Load Boards (School) OR Universities (University)
    useEffect(() => {
        if (selectedState && flowType === 'school') {
            api.get(`/structure/boards/${selectedState}?language=${language}`).then(res => setBoards(res.data));
        } else if (selectedState && flowType === 'university') {
            api.get(`/structure/universities/${selectedState}?language=${language}`).then(res => setUniversities(res.data));
        } else {
            setBoards([]);
            setUniversities([]);
        }
    }, [selectedState, flowType, language]);

    // Board changes -> Load Classes & Streams
    useEffect(() => {
        if (selectedBoard && flowType === 'school') {
            api.get(`/structure/classes/${selectedBoard}?language=${language}`).then(res => setClasses(res.data));
        } else {
            setClasses([]);
            setStreams([]);
        }
    }, [selectedBoard, flowType, language]);

    // Class changes -> Load Streams (with auto-fetch AI if empty)
    useEffect(() => {
        if (selectedBoard && selectedClass && flowType === 'school') {
            api.get(`/structure/streams?board_id=${selectedBoard}&class_id=${selectedClass}&language=${language}`)
                .then(res => setStreams(res.data));
        } else if (!selectedClass) {
            setStreams([]);
        }
    }, [selectedBoard, selectedClass, flowType, language]);

    // University changes -> Load Degree Types
    useEffect(() => {
        if (selectedUniversity && flowType === 'university') {
            api.get(`/structure/degree-types/${selectedUniversity}`).then(res => setDegreeTypes(res.data)).catch(() => setDegreeTypes([]));
        } else {
            setDegreeTypes([]);
        }
    }, [selectedUniversity, flowType]);

    // Category changes (Competitive) -> Load Papers Stages
    useEffect(() => {
        if (selectedCat && flowType === 'competitive') {
            api.get(`/structure/papers-stages/${selectedCat}`).then(res => setPapersStages(res.data));
        } else {
            setPapersStages([]);
        }
    }, [selectedCat, flowType]);

    // Subject loading unified handler
    useEffect(() => {
        let url = `/structure/subjects?category_id=${selectedCat}&language=${language}`;
        let shouldFetch = false;

        if (flowType === 'school' && selectedClass) {
            url += `&board_id=${selectedBoard}&class_id=${selectedClass}`;
            if (selectedStream) url += `&stream_id=${selectedStream}`;
            shouldFetch = true;
        } else if (flowType === 'university' && selectedUniversity && selectedDegreeType) {
            url += `&university_id=${selectedUniversity}&degree_type_id=${selectedDegreeType}`;
            shouldFetch = true;
        } else if (flowType === 'competitive' && selectedPaperStage) {
            url += `&paper_stage_id=${selectedPaperStage}`;
            shouldFetch = true;
        }

        if (shouldFetch) {
            api.get(url).then(res => setSubjects(res.data));
        } else {
            setSubjects([]);
        }
    }, [selectedCat, flowType, selectedClass, selectedBoard, selectedStream, selectedUniversity, selectedDegreeType, selectedPaperStage, language]);

    // Chapter Loading
    useEffect(() => {
        if (selectedSubject) {
            api.get(`/structure/chapters/${selectedSubject}?language=${language}`).then(res => setChapters(res.data));
        } else {
            setChapters([]);
        }
    }, [selectedSubject, language]);


    // Helper functions for School UI logic
    const getClassNumber = (className = '') => {
        if (!className) return 0;
        const name = className.trim().toUpperCase();
        // Roman numeral mapping for class 11 & 12
        if (name.includes('XII') || name.includes('12') || name.includes('TWELVE')) return 12;
        if (name.includes('XI') || name.includes('11') || name.includes('ELEVEN')) return 11;
        // Fallback: extract any digit sequence
        const digits = name.replace(/\D/g, '');
        return digits ? parseInt(digits) : 0;
    };
    const selectedClassName = selectedClass
        ? (classes.find(c => c.id == selectedClass)?.name || '')
        : '';
    const classNum = getClassNumber(selectedClassName);
    const needsStream = classNum >= 11;


    // ── SESSION START ──
    const startSoloPractice = async () => {
        setLoading(true);
        setError('');
        try {
            let topicName = '';
            if (selectedChapter) {
                const chap = chapters.find(c => c.id == selectedChapter);
                if (chap) topicName = chap.name;
            } else if (selectedSubject) {
                const sub = subjects.find(s => s.id == selectedSubject);
                if (sub) topicName = sub.name;
            }

            if (!topicName) topicName = 'General Topics';

            // Use the Live AI Generation endpoint
            const res = await api.post('/mcq/generate-practice', {
                topic: topicName,
                language: language,
                limit: 5 // Reduced from 10 to halve AI processing time
            });

            if (!res.data.mcqs || res.data.mcqs.length === 0) {
                setError('No questions available for this selection. Try another chapter.');
            } else {
                setQuestions(res.data.mcqs);
                setSessionInfo(res.data.sessionInfo);
                setMode('solo');
            }
        } catch (err) {
            if (err.response?.data?.code === 'LIMIT_REACHED' || err.response?.data?.code === 'SESSIONS_EXHAUSTED') {
                setShowPopup(true);
            } else {
                setError(err.response?.data?.message || 'Failed to start practice session');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSessionComplete = (data) => {
        // Notify Flutter APK that a session has ended (for interstitial ad counting)
        if (window.FlutterAdChannel) {
            window.FlutterAdChannel.postMessage('sessionComplete');
        }
        setMode(null);
        setQuestions([]);
    };

    // ── USER AI FETCH HANDLER ──
    const handleAIFetch = async (type) => {
        setIsFetchingAI(type);
        try {
            if (type === 'boards') {
                const s = states.find(x => x.id == selectedState);
                if (!s) return;
                await api.post('/structure/fetch-out-boards', { state_id: s.id, state_name: s.name });
                const res = await api.get(`/structure/boards/${selectedState}`);
                setBoards(res.data);
            } else if (type === 'classes') {
                const b = boards.find(x => x.id == selectedBoard);
                if (!b) return;
                await api.post('/structure/fetch-out-classes', { board_id: b.id, board_name: b.name });
                const res = await api.get(`/structure/classes/${selectedBoard}`);
                setClasses(res.data);
            } else if (type === 'streams') {
                const b = boards.find(x => x.id == selectedBoard);
                const c = classes.find(x => x.class_id == selectedClass || x.id == selectedClass);
                if (!b || !c) return;
                await api.post('/structure/fetch-out-streams', { board_name: b.name, class_name: c.name });
                const res = await api.get(`/structure/streams`);
                setStreams(res.data);
            } else if (type === 'universities') {
                const s = states.find(x => x.id == selectedState);
                if (!s) return;
                await api.post('/structure/fetch-out-universities', { state_id: s.id, state_name: s.name });
                const res = await api.get(`/structure/universities/${selectedState}`);
                setUniversities(res.data);
            } else if (type === 'degreeTypes') {
                const u = universities.find(x => x.id == selectedUniversity);
                if (!u) return;
                await api.post('/structure/fetch-out-degree-types', { university_id: u.id, university_name: u.name });
                const res = await api.get(`/structure/degree-types/${selectedUniversity}`);
                setDegreeTypes(res.data);
            } else if (type === 'papersStages') {
                const c = categories.find(x => x.id == selectedCat);
                if (!c) return;
                await api.post('/structure/fetch-out-papers-stages', { category_id: c.id, category_name: c.name });
                const res = await api.get(`/structure/papers-stages/${selectedCat}`);
                setPapersStages(res.data);
            } else if (type === 'subjects') {
                let payload = {};
                let url = '';
                if (flowType === 'school') {
                    const b = boards.find(x => x.id == selectedBoard);
                    const c = classes.find(x => (x.class_id || x.id) == selectedClass);
                    const st = streams.find(x => x.id == selectedStream);
                    if (!b || !c) return;
                    payload = {
                        board_id: b.id, board_name: b.name,
                        class_id: c.class_id || c.id, class_name: c.name,
                        stream_id: st?.id, stream_name: st?.name
                    };
                    url = `/structure/subjects?category_id=${selectedCat}&board_id=${selectedBoard}&class_id=${selectedClass}`;
                    if (selectedStream) url += `&stream_id=${selectedStream}`;
                } else if (flowType === 'university') {
                    const u = universities.find(x => x.id == selectedUniversity);
                    const dt = degreeTypes.find(x => x.id == selectedDegreeType);
                    if (!u || !dt) return;
                    payload = {
                        university_id: u.id, university_name: u.name,
                        degree_type_id: dt.id, degree_type_name: dt.name,
                        category_id: selectedCat
                    };
                    url = `/structure/subjects?category_id=${selectedCat}&university_id=${selectedUniversity}&degree_type_id=${selectedDegreeType}`;
                } else if (flowType === 'competitive') {
                    const ps = papersStages.find(x => x.id == selectedPaperStage);
                    const cat = categories.find(x => x.id == selectedCat);
                    if (!ps || !cat) return;
                    payload = {
                        paper_stage_id: ps.id, paper_stage_name: ps.name,
                        category_id: cat.id, category_name: cat.name
                    };
                    url = `/structure/subjects?category_id=${selectedCat}&paper_stage_id=${selectedPaperStage}`;
                }
                await api.post('/structure/fetch-out-subjects', payload);
                const res = await api.get(url);
                setSubjects(res.data);
            } else if (type === 'chapters') {
                const s = subjects.find(x => x.id == selectedSubject);
                if (!s) return;
                let payload = { subject_id: s.id, subject_name: s.name };

                if (flowType === 'school') {
                    const b = boards.find(x => x.id == selectedBoard);
                    const c = classes.find(x => (x.class_id || x.id) == selectedClass);
                    if (!b || !c) return;
                    payload.board_name = b.name;
                    payload.class_name = c.name;
                } else if (flowType === 'university') {
                    const u = universities.find(x => x.id == selectedUniversity);
                    const dt = degreeTypes.find(x => x.id == selectedDegreeType);
                    if (!u || !dt) return;
                    payload.university_name = u.name;
                    payload.degree_type_name = dt.name;
                } else if (flowType === 'competitive') {
                    const ps = papersStages.find(x => x.id == selectedPaperStage);
                    const cat = categories.find(x => x.id == selectedCat);
                    if (!ps || !cat) return;
                    payload.paper_stage_name = ps.name;
                    payload.category_name = cat.name;
                }

                await api.post('/structure/fetch-out-chapters', payload);
                const res = await api.get(`/structure/chapters/${selectedSubject}`);
                setChapters(res.data);
            }
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || `Failed to fetch ${type} via AI`);
        } finally {
            setIsFetchingAI('');
        }
    };

    // ── RENDERERS ──

    if (mode === 'solo' && questions.length > 0) {
        return (
            <div className="container mx-auto px-4 py-8">
                <MCQSession questions={questions} sessionInfo={sessionInfo} onComplete={handleSessionComplete} />
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-12 w-full max-w-[1400px] flex flex-col xl:flex-row gap-8 justify-center items-start">
            {/* Left Ad Sidebar */}
            <div className="hidden xl:block w-[160px] shrink-0 sticky top-24">
                <AdSlot type="left" />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 w-full max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">Ready to Practice?</h1>
                <AdSlot type="mid" />

                {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-8 text-center">{error}</div>}

                <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 space-y-6">

                    {/* 1. Category Identifier - Global for all flows */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select Category</label>
                        <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold text-indigo-900"
                            value={selectedCat} onChange={e => setSelectedCat(e.target.value)}>
                            <option value="">Choose Category</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* 2. Language Selector - Shown immediately after Category */}
                    {selectedCat && (
                        <div className="pt-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">🌐 Exam Language</label>
                            <select className="w-full p-3 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold" value={language} onChange={e => setLanguage(e.target.value)}>
                                <option value="English">English</option>
                                <option value="Bengali">Bengali (বাংলা)</option>
                                <option value="Hindi">Hindi (हिंदी)</option>
                                <option value="Tamil">Tamil (தமிழ்)</option>
                                <option value="Telugu">Telugu (తెలుగు)</option>
                                <option value="Marathi">Marathi (मराठी)</option>
                                <option value="Gujarati">Gujarati (ગુજરાતી)</option>
                                <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
                                <option value="Malayalam">Malayalam (മലയാളം)</option>
                                <option value="Odia">Odia (ଓଡ଼ିଆ)</option>
                                <option value="Punjabi">Punjabi (ਪੰਜਾਬੀ)</option>
                                <option value="Assamese">Assamese (অসমীয়া)</option>
                                <option value="Urdu">Urdu (اردو)</option>
                                <option value="Sanskrit">Sanskrit (संस्कृत)</option>
                            </select>
                            <p className="text-xs text-indigo-500 font-medium mt-2">* Class, Subject & Chapter names and MCQs will be shown in your chosen language.</p>
                        </div>
                    )}

                    {/* ── FLOW SPECIFIC UIs ── */}

                    {/* SCHOOL FLOW */}
                    {flowType === 'school' && selectedCat && (
                        <>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select State</label>
                                    <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary" value={selectedState} onChange={e => setSelectedState(e.target.value)}>
                                        <option value="">Choose State</option>
                                        {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select Board</label>
                                    <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary" value={selectedBoard} onChange={e => setSelectedBoard(e.target.value)} disabled={!selectedState || isFetchingAI === 'boards'}>
                                        <option value="">{isFetchingAI === 'boards' ? 'Generating by AI...' : 'Choose Board'}</option>
                                        {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                    {selectedState && boards.length === 0 && (
                                        <button onClick={() => handleAIFetch('boards')} disabled={isFetchingAI === 'boards'}
                                            className="mt-2 w-full text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 py-2 rounded-lg hover:bg-indigo-100 transition-all flex items-center justify-center gap-1 disabled:opacity-50">
                                            ✨ {isFetchingAI === 'boards' ? 'Searching Internet...' : 'Fetch Official Boards via Neural Engine'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select Class</label>
                                    <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedStream(''); setSelectedSubject(''); }} disabled={!selectedBoard || isFetchingAI === 'classes'}>
                                        <option value="">{isFetchingAI === 'classes' ? 'Processing...' : 'Choose Class'}</option>
                                        {classes.map(c => <option key={c.id} value={c.class_id || c.id}>{c.name}</option>)}
                                    </select>
                                    {selectedBoard && classes.length === 0 && (
                                        <button onClick={() => handleAIFetch('classes')} disabled={isFetchingAI === 'classes'}
                                            className="mt-2 w-full text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 py-2 rounded-lg hover:bg-indigo-100 transition-all flex items-center justify-center gap-1 disabled:opacity-50">
                                            ✨ {isFetchingAI === 'classes' ? 'Building Structure...' : 'Fetch Official Classes via Neural Engine'}
                                        </button>
                                    )}
                                </div>
                                {needsStream ? (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select Stream</label>
                                        <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary" value={selectedStream} onChange={e => { setSelectedStream(e.target.value); setSelectedSubject(''); }} disabled={!selectedClass || isFetchingAI === 'streams'}>
                                            <option value="">{isFetchingAI === 'streams' ? 'Processing...' : 'Choose Stream'}</option>
                                            {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        {selectedClass && streams.length === 0 && (
                                            <button onClick={() => handleAIFetch('streams')} disabled={isFetchingAI === 'streams'}
                                                className="mt-2 w-full text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 py-2 rounded-lg hover:bg-indigo-100 transition-all flex items-center justify-center gap-1 disabled:opacity-50">
                                                ✨ {isFetchingAI === 'streams' ? 'Discovering Branches...' : 'Fetch Official Streams via Neural Engine'}
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select Subject</label>
                                        <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary" value={selectedSubject} onChange={e => { setSelectedSubject(e.target.value); setSelectedChapter(''); }} disabled={!selectedClass || isFetchingAI === 'subjects'}>
                                            <option value="">{isFetchingAI === 'subjects' ? 'Generating Syllabus...' : 'Choose Subject'}</option>
                                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        {selectedClass && subjects.length === 0 && (
                                            <button onClick={() => handleAIFetch('subjects')} disabled={isFetchingAI === 'subjects'}
                                                className="mt-2 w-full text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 py-2 rounded-lg hover:bg-indigo-100 transition-all flex items-center justify-center gap-1 disabled:opacity-50">
                                                ✨ {isFetchingAI === 'subjects' ? 'Fetching Syllabus...' : 'Fetch Missing Subjects'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* UNIVERSITY FLOW */}
                    {flowType === 'university' && selectedCat && (
                        <>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select State</label>
                                    <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary" value={selectedState} onChange={e => setSelectedState(e.target.value)}>
                                        <option value="">Choose State</option>
                                        {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select University</label>
                                    <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary" value={selectedUniversity} onChange={e => setSelectedUniversity(e.target.value)} disabled={!selectedState || isFetchingAI === 'universities'}>
                                        <option value="">{isFetchingAI === 'universities' ? 'Generating...' : 'Choose University'}</option>
                                        {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                    {selectedState && universities.length === 0 && (
                                        <button onClick={() => handleAIFetch('universities')} disabled={isFetchingAI === 'universities'}
                                            className="mt-2 w-full text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 py-2 rounded-lg hover:bg-indigo-100 transition-all flex items-center justify-center gap-1 disabled:opacity-50">
                                            ✨ {isFetchingAI === 'universities' ? 'Fetching Universities...' : 'Fetch Official Universities via Neural Engine'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select Degree Type</label>
                                    <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary" value={selectedDegreeType} onChange={e => { setSelectedDegreeType(e.target.value); setSelectedSubject(''); }} disabled={!selectedUniversity || isFetchingAI === 'degreeTypes'}>
                                        <option value="">{isFetchingAI === 'degreeTypes' ? 'Generating Degrees...' : 'Choose Degree Type'}</option>
                                        {degreeTypes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                    {selectedUniversity && degreeTypes.length === 0 && (
                                        <button onClick={() => handleAIFetch('degreeTypes')} disabled={isFetchingAI === 'degreeTypes'}
                                            className="mt-2 w-full text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 py-2 rounded-lg hover:bg-indigo-100 transition-all flex items-center justify-center gap-1 disabled:opacity-50">
                                            ✨ {isFetchingAI === 'degreeTypes' ? 'Fetching Degrees...' : 'Fetch Official Degree Types via Neural Engine'}
                                        </button>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select Subject</label>
                                    <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary" value={selectedSubject} onChange={e => { setSelectedSubject(e.target.value); setSelectedChapter(''); }} disabled={!selectedDegreeType || isFetchingAI === 'subjects'}>
                                        <option value="">{isFetchingAI === 'subjects' ? 'Generating Syllabus...' : 'Choose Subject'}</option>
                                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    {selectedDegreeType && subjects.length === 0 && (
                                        <button onClick={() => handleAIFetch('subjects')} disabled={isFetchingAI === 'subjects'}
                                            className="mt-2 w-full text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 py-2 rounded-lg hover:bg-indigo-100 transition-all flex items-center justify-center gap-1 disabled:opacity-50">
                                            ✨ {isFetchingAI === 'subjects' ? 'Fetching Syllabus...' : 'Fetch Missing Subjects'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* COMPETITIVE FLOW */}
                    {flowType === 'competitive' && selectedCat && (
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select Exam Stage / Paper</label>
                                <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary" value={selectedPaperStage} onChange={e => { setSelectedPaperStage(e.target.value); setSelectedSubject(''); }} disabled={!selectedCat || isFetchingAI === 'papersStages'}>
                                    <option value="">{isFetchingAI === 'papersStages' ? 'Generating...' : 'Choose Exam Stage'}</option>
                                    {papersStages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                {selectedCat && papersStages.length === 0 && (
                                    <button onClick={() => handleAIFetch('papersStages')} disabled={isFetchingAI === 'papersStages'}
                                        className="mt-2 w-full text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 py-2 rounded-lg hover:bg-indigo-100 transition-all flex items-center justify-center gap-1 disabled:opacity-50">
                                        ✨ {isFetchingAI === 'papersStages' ? 'Fetching Stages...' : 'Fetch Official Exam Stages'}
                                    </button>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select Subject</label>
                                <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary" value={selectedSubject} onChange={e => { setSelectedSubject(e.target.value); setSelectedChapter(''); }} disabled={!selectedPaperStage || isFetchingAI === 'subjects'}>
                                    <option value="">{isFetchingAI === 'subjects' ? 'Generating Syllabus...' : 'Choose Subject'}</option>
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                {selectedPaperStage && subjects.length === 0 && (
                                    <button onClick={() => handleAIFetch('subjects')} disabled={isFetchingAI === 'subjects'}
                                        className="mt-2 w-full text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 py-2 rounded-lg hover:bg-indigo-100 transition-all flex items-center justify-center gap-1 disabled:opacity-50">
                                        ✨ {isFetchingAI === 'subjects' ? 'Fetching Syllabus...' : 'Fetch Missing Subjects'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}


                    {/* ── COMMON CHAPTER SELECTOR & ACTION BUTTON ── */}

                    {selectedCat && (
                        <>
                            {/* If it's School Stream mode we need a different layout to match the original, but let's just use grid logic */}
                            {((flowType === 'school' && needsStream) || flowType !== 'school') && selectedSubject !== false && (
                                <div className={`grid md:grid-cols-2 gap-6 ${(flowType === 'competitive' || flowType === 'university') ? 'mt-0' : 'mt-0'}`}>
                                    {flowType === 'school' && needsStream && (
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select Subject</label>
                                            <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary" value={selectedSubject} onChange={e => { setSelectedSubject(e.target.value); setSelectedChapter(''); }} disabled={!selectedStream || isFetchingAI === 'subjects'}>
                                                <option value="">{isFetchingAI === 'subjects' ? 'Fetching Syllabus...' : 'Choose Subject'}</option>
                                                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                            {selectedStream && subjects.length === 0 && (
                                                <button onClick={() => handleAIFetch('subjects')} disabled={isFetchingAI === 'subjects'}
                                                    className="mt-2 w-full text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 py-2 rounded-lg hover:bg-indigo-100 transition-all flex items-center justify-center gap-1 disabled:opacity-50">
                                                    ✨ {isFetchingAI === 'subjects' ? 'Deep AI Search...' : 'Fetch Missing Subjects'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <div className={flowType !== 'school' || !needsStream ? 'col-span-1' : ''}>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select Chapter</label>
                                        <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary" value={selectedChapter} onChange={e => setSelectedChapter(e.target.value)} disabled={!selectedSubject || isFetchingAI === 'chapters'}>
                                            <option value="">{isFetchingAI === 'chapters' ? 'Reading Books...' : 'Choose Chapter'}</option>
                                            {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        {selectedSubject && chapters.length === 0 && (
                                            <button onClick={() => handleAIFetch('chapters')} disabled={isFetchingAI === 'chapters'}
                                                className="mt-2 w-full text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 py-2 rounded-lg hover:bg-indigo-100 transition-all flex items-center justify-center gap-1 disabled:opacity-50">
                                                ✨ {isFetchingAI === 'chapters' ? 'Extracting Chapters...' : 'Fetch Official Chapters via NCERT/Board Logic'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {flowType === 'school' && !needsStream && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select Chapter</label>
                                    <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary" value={selectedChapter} onChange={e => setSelectedChapter(e.target.value)} disabled={!selectedSubject || isFetchingAI === 'chapters'}>
                                        <option value="">{isFetchingAI === 'chapters' ? 'Loading Chapters...' : 'Choose Chapter'}</option>
                                        {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    {selectedSubject && chapters.length === 0 && (
                                        <button onClick={() => handleAIFetch('chapters')} disabled={isFetchingAI === 'chapters'}
                                            className="mt-2 w-full text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 py-2 rounded-lg hover:bg-indigo-100 transition-all flex items-center justify-center gap-1 disabled:opacity-50">
                                            ✨ {isFetchingAI === 'chapters' ? 'Compiling Texts...' : 'Fetch Official Chapters via NCERT/Board Logic'}
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="pt-4 border-t border-gray-100 text-center text-xs text-indigo-400 font-medium">
                                🌐 MCQs will be generated in <strong>{language}</strong>
                            </div>

                            <button
                                onClick={startSoloPractice}
                                disabled={!selectedChapter || loading}
                                className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:shadow-indigo-200 transition-all hover:-translate-y-1 block text-center mt-6 disabled:opacity-50 disabled:hover:translate-y-0 relative overflow-hidden"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                                        Generating AI Exam in {language}...
                                    </span>
                                ) : 'Start Practice Now'}
                            </button>
                        </>
                    )}
                </div>

                <div className="mt-12 text-center text-gray-400 mb-8">
                    <p className="text-sm">Want to compete with friends? <button onClick={() => navigate('/group')} className="text-secondary font-bold hover:underline">Launch Group Mode</button></p>
                </div>

                <AdSlot type="bottom" />
            </div>

            {/* Right Ad Sidebar */}
            <div className="hidden xl:block w-[160px] shrink-0 sticky top-24">
                <AdSlot type="right" />
            </div>

            {showPopup && <PrimePopup onClose={() => setShowPopup(false)} />}
        </div>
    );
};

export default Practice;

import React, { useState } from 'react';
import api from '../services/api';

const MCQSession = ({ questions, onComplete, onFetchNext, mode = 'practice', sessionId = null, sessionInfo = null }) => {
    const [isLoadingNext, setIsLoadingNext] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isChecked, setIsChecked] = useState(false);
    const [result, setResult] = useState(null); // { is_correct, explanation, correct_option }
    const [score, setScore] = useState(0);
    const [history, setHistory] = useState([]); // Track user answers

    const currentQuestion = questions[currentIndex];

    const handleOptionSelect = async (index) => {
        if (isChecked) return;
        setSelectedOption(index);

        try {
            const res = await api.post('/mcq/submit', {
                mcq_id: currentQuestion.id,
                selected_option: index,
                actual_correct_option: currentQuestion.correct_option
            });

            setResult(res.data);
            setIsChecked(true);

            if (res.data.is_correct) {
                setScore(s => s + 1);
            }

            // If group mode, submit score update
            if (mode === 'group' && sessionId) {
                setScore(currentScore => {
                    const newScore = currentScore + (res.data.is_correct ? 1 : 0);
                    api.post(`/group/${sessionId}/submit`, { score: newScore });
                    return newScore;
                });
            }

        } catch (error) {
            console.error("Failed to submit answer", error);
        }
    };

    const handleNext = async () => {
        setSelectedOption(null);
        setIsChecked(false);
        setResult(null);

        // If we are at the last available question but not at the total limit (e.g. 10)
        if (currentIndex === questions.length - 1 && questions.length < 10 && mode === 'group') {
            if (onFetchNext) {
                setIsLoadingNext(true);
                const success = await onFetchNext();
                setIsLoadingNext(false);
                if (success) {
                    setCurrentIndex(currentIndex + 1);
                }
            }
        } else if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            onComplete({ score, total: questions.length });
        }
    };

    if (!currentQuestion) return <div>Loading questions...</div>;

    const options = typeof currentQuestion.options === 'string'
        ? JSON.parse(currentQuestion.options)
        : currentQuestion.options;

    return (
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center text-sm md:text-base">
                <span className="text-gray-600 font-medium whitespace-nowrap">Q: {currentIndex + 1} / {questions.length}</span>
                {sessionInfo && !sessionInfo.isPremium && (
                    <span className="text-indigo-600 font-bold bg-indigo-100 px-3 py-1 rounded-full text-xs md:text-sm whitespace-nowrap hidden sm:inline-block">
                        Sessions Used: {sessionInfo.used} / {sessionInfo.total}
                    </span>
                )}
                {sessionInfo && sessionInfo.isPremium && sessionInfo.left > 0 && (
                    <span className="text-amber-600 font-bold bg-amber-100 px-3 py-1 rounded-full text-xs md:text-sm whitespace-nowrap hidden sm:inline-block">
                        Premium Sessions left: {sessionInfo.left}
                    </span>
                )}
                <span className="text-primary font-bold whitespace-nowrap">Score: {score}</span>
            </div>

            {/* Question Body */}
            <div className="p-6 md:p-8">
                <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-6">{currentQuestion.question}</h3>

                <div className="space-y-4">
                    {options.map((option, index) => {
                        let optionClass = "w-full text-left p-4 rounded-lg border-2 transition flex items-center";

                        if (isChecked) {
                            if (index === result?.correct_option) {
                                optionClass += " border-green-500 bg-green-50 text-green-700 font-medium";
                            } else if (index === selectedOption && !result?.is_correct) {
                                optionClass += " border-red-500 bg-red-50 text-red-700";
                            } else {
                                optionClass += " border-gray-200 opacity-50";
                            }
                        } else {
                            if (selectedOption === index) {
                                optionClass += " border-primary bg-indigo-50 text-primary";
                            } else {
                                optionClass += " border-gray-200 hover:border-indigo-300 hover:bg-gray-50";
                            }
                        }

                        return (
                            <button
                                key={index}
                                onClick={() => handleOptionSelect(index)}
                                disabled={isChecked}
                                className={optionClass}
                            >
                                <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mr-4 text-sm font-bold ${isChecked && index === result?.correct_option ? "border-green-500 bg-green-500 text-white" :
                                    isChecked && index === selectedOption && !result?.is_correct ? "border-red-500 bg-red-500 text-white" :
                                        selectedOption === index ? "border-primary bg-primary text-white" : "border-gray-300 text-gray-500"
                                    }`}>
                                    {String.fromCharCode(65 + index)}
                                </span>
                                {option}
                            </button>
                        );
                    })}
                </div>

                {/* Explanation */}
                {isChecked && (result?.explanation || currentQuestion.explanation) && (
                    <div className={`mt-6 p-4 rounded-lg shadow-inner ${result.is_correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <h4 className={`font-black uppercase tracking-wider mb-2 ${result.is_correct ? 'text-green-800' : 'text-red-800'}`}>
                            {result.is_correct ? 'Correct Answer!' : 'Incorrect Answer'}
                        </h4>
                        <p className="text-gray-900 font-medium leading-relaxed">{result?.explanation || currentQuestion.explanation}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="mt-8 flex justify-end space-x-4">
                    {isChecked && (
                        <button
                            onClick={handleNext}
                            disabled={isLoadingNext}
                            className={`${isLoadingNext ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} text-white px-8 py-3 rounded-xl font-bold shadow-lg transition flex items-center`}
                        >
                            {isLoadingNext ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Generating...
                                </>
                            ) : (
                                <>{currentIndex === questions.length - 1 && questions.length === 10 ? 'Finish' : 'Next Question'}</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MCQSession;

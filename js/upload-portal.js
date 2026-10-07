/**
 * OneSpace Digital Correction - Upload Desk & Hierarchical PDF Ingestion
 * Workflow: Subject (3 subjects) -> Exam Template (2-3 templates) -> Class -> PDF Upload Studio
 * Integrates with PDF.js for client-side page rendering and pushes directly to appStorage.
 */

class UploadPortalManager {
    constructor(containerElement, options = {}) {
        this.container = containerElement;
        this.options = Object.assign({
            onOpenWorkspace: null,
            onSwitchToEvaluator: null
        }, options);

        // Hierarchical Selection State
        this.currentStep = 1; // 1: Subject, 2: Template, 3: Class, 4: Upload
        this.selectedSubject = null;
        this.selectedTemplate = null;
        this.selectedClass = null;

        // Upload Queue State
        this.fileQueue = []; // Array of { file, studentName, rollNo, pages: [], isProcessing: false, isReady: false }
        this.existingPapers = []; // Papers already uploaded for this Subject + Template + Class

        // Predefined Subjects with Templates
        this.catalog = [
            {
                id: "phy",
                name: "Physics",
                code: "PHY-301",
                badge: "3 Templates",
                description: "Electromagnetism, Optics, Mechanics & Modern Physics answer sheets",
                templates: [
                    {
                        id: "phy-cbse-70",
                        name: "Physics Board Paper (33 Qs / 70 Marks)",
                        examName: "Annual Physics Board Assessment 2026",
                        maxMarks: 70,
                        duration: "3 Hours",
                        badge: "Official Blueprint",
                        sections: [
                            {
                                id: "sec_a",
                                letter: "A",
                                name: "Section A",
                                title: "Section A - Multiple Choice Questions (Q1 to Q16)",
                                qStartNo: 1,
                                qEndNo: 16,
                                qCount: 16,
                                marksPerQ: 1,
                                maxMarks: 16,
                                secTotal: 16,
                                hasChoice: false,
                                hasSubQuestions: false,
                                subQuestions: []
                            },
                            {
                                id: "sec_b",
                                letter: "B",
                                name: "Section B",
                                title: "Section B - Very Short Answer Questions (Q17 to Q21)",
                                qStartNo: 17,
                                qEndNo: 21,
                                qCount: 5,
                                marksPerQ: 2,
                                maxMarks: 10,
                                secTotal: 10,
                                hasChoice: false,
                                hasSubQuestions: false,
                                subQuestions: []
                            },
                            {
                                id: "sec_c",
                                letter: "C",
                                name: "Section C",
                                title: "Section C - Short Answer Questions (Q22 to Q28)",
                                qStartNo: 22,
                                qEndNo: 28,
                                qCount: 7,
                                marksPerQ: 3,
                                maxMarks: 21,
                                secTotal: 21,
                                hasChoice: false,
                                hasSubQuestions: false,
                                subQuestions: []
                            },
                            {
                                id: "sec_d",
                                letter: "D",
                                name: "Section D",
                                title: "Section D - Case Study-Based Questions (Q29 & Q30)",
                                qStartNo: 29,
                                qEndNo: 30,
                                qCount: 2,
                                marksPerQ: 4,
                                maxMarks: 8,
                                secTotal: 8,
                                hasChoice: false,
                                hasSubQuestions: false,
                                subQuestions: []
                            },
                            {
                                id: "sec_e",
                                letter: "E",
                                name: "Section E",
                                title: "Section E - Long Answer Questions (Q31 to Q33)",
                                qStartNo: 31,
                                qEndNo: 33,
                                qCount: 3,
                                marksPerQ: 5,
                                maxMarks: 15,
                                secTotal: 15,
                                hasChoice: false,
                                hasSubQuestions: false,
                                subQuestions: []
                            }
                        ],
                        questions: [
                            { id: "q1", qNo: 1, qNumber: "Q1", label: "Q1", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Electric Charges & Fields (MCQ)" },
                            { id: "q2", qNo: 2, qNumber: "Q2", label: "Q2", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Electrostatic Potential (MCQ)" },
                            { id: "q3", qNo: 3, qNumber: "Q3", label: "Q3", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Current Electricity & Ohm's Law (MCQ)" },
                            { id: "q4", qNo: 4, qNumber: "Q4", label: "Q4", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Moving Charges & Magnetism (MCQ)" },
                            { id: "q5", qNo: 5, qNumber: "Q5", label: "Q5", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Magnetism and Matter (MCQ)" },
                            { id: "q6", qNo: 6, qNumber: "Q6", label: "Q6", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Electromagnetic Induction (MCQ)" },
                            { id: "q7", qNo: 7, qNumber: "Q7", label: "Q7", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Alternating Current & Resonance (MCQ)" },
                            { id: "q8", qNo: 8, qNumber: "Q8", label: "Q8", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Electromagnetic Waves (MCQ)" },
                            { id: "q9", qNo: 9, qNumber: "Q9", label: "Q9", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Ray Optics & Prism (MCQ)" },
                            { id: "q10", qNo: 10, qNumber: "Q10", label: "Q10", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Wave Optics & Interference (MCQ)" },
                            { id: "q11", qNo: 11, qNumber: "Q11", label: "Q11", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Dual Nature of Radiation (MCQ)" },
                            { id: "q12", qNo: 12, qNumber: "Q12", label: "Q12", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Atoms & Bohr Model (MCQ)" },
                            { id: "q13", qNo: 13, qNumber: "Q13", label: "Q13", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Nuclei & Radioactivity (MCQ)" },
                            { id: "q14", qNo: 14, qNumber: "Q14", label: "Q14", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Semiconductor Electronics (MCQ)" },
                            { id: "q15", qNo: 15, qNumber: "Q15", label: "Q15", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Assertion-Reason: Electrostatics" },
                            { id: "q16", qNo: 16, qNumber: "Q16", label: "Q16", maxMarks: 1, section: "Section A", sectionId: "sec_a", topic: "Assertion-Reason: Optics" },
                            { id: "q17", qNo: 17, qNumber: "Q17", label: "Q17", maxMarks: 2, section: "Section B", sectionId: "sec_b", topic: "Electric Dipole Torque & Field (VSA)" },
                            { id: "q18", qNo: 18, qNumber: "Q18", label: "Q18", maxMarks: 2, section: "Section B", sectionId: "sec_b", topic: "Drift Velocity & Resistance (VSA)" },
                            { id: "q19", qNo: 19, qNumber: "Q19", label: "Q19", maxMarks: 2, section: "Section B", sectionId: "sec_b", topic: "Self & Mutual Inductance (VSA)" },
                            { id: "q20", qNo: 20, qNumber: "Q20", label: "Q20", maxMarks: 2, section: "Section B", sectionId: "sec_b", topic: "De Broglie Wavelength Calculation (VSA)" },
                            { id: "q21", qNo: 21, qNumber: "Q21", label: "Q21", maxMarks: 2, section: "Section B", sectionId: "sec_b", topic: "p-n Junction Diode Characteristics (VSA)" },
                            { id: "q22", qNo: 22, qNumber: "Q22", label: "Q22", maxMarks: 3, section: "Section C", sectionId: "sec_c", topic: "Gauss's Law & Spherical Shell (SA)" },
                            { id: "q23", qNo: 23, qNumber: "Q23", label: "Q23", maxMarks: 3, section: "Section C", sectionId: "sec_c", topic: "Wheatstone Bridge & Kirchhoff's Rules (SA)" },
                            { id: "q24", qNo: 24, qNumber: "Q24", label: "Q24", maxMarks: 3, section: "Section C", sectionId: "sec_c", topic: "Biot-Savart Law & Circular Loop (SA)" },
                            { id: "q25", qNo: 25, qNumber: "Q25", label: "Q25", maxMarks: 3, section: "Section C", sectionId: "sec_c", topic: "Transformer Principle & Efficiency (SA)" },
                            { id: "q26", qNo: 26, qNumber: "Q26", label: "Q26", maxMarks: 3, section: "Section C", sectionId: "sec_c", topic: "Lens Maker's Formula Derivation (SA)" },
                            { id: "q27", qNo: 27, qNumber: "Q27", label: "Q27", maxMarks: 3, section: "Section C", sectionId: "sec_c", topic: "Young's Double Slit Experiment (SA)" },
                            { id: "q28", qNo: 28, qNumber: "Q28", label: "Q28", maxMarks: 3, section: "Section C", sectionId: "sec_c", topic: "Photoelectric Effect & Einstein's Equation (SA)" },
                            { id: "q29", qNo: 29, qNumber: "Q29", label: "Q29", maxMarks: 4, section: "Section D", sectionId: "sec_d", topic: "Case Study 1: Total Internal Reflection & Optical Fibres" },
                            { id: "q30", qNo: 30, qNumber: "Q30", label: "Q30", maxMarks: 4, section: "Section D", sectionId: "sec_d", topic: "Case Study 2: Solar Cell & Semiconductor Photodiodes" },
                            { id: "q31", qNo: 31, qNumber: "Q31", label: "Q31", maxMarks: 5, section: "Section E", sectionId: "sec_e", topic: "Parallel Plate Capacitor & Dielectric Slab (LA)" },
                            { id: "q32", qNo: 32, qNumber: "Q32", label: "Q32", maxMarks: 5, section: "Section E", sectionId: "sec_e", topic: "AC Generator Derivation & Phasor Diagrams (LA)" },
                            { id: "q33", qNo: 33, qNumber: "Q33", label: "Q33", maxMarks: 5, section: "Section E", sectionId: "sec_e", topic: "Astronomical Telescope Derivation & Ray Diagram (LA)" }
                        ]
                    },
                    {
                        id: "phy-rev1-80",
                        name: "Grade 12 Physics Revision 1 (80 Marks)",
                        examName: "Grade 12 Physics Revision 1 Assessment 2026",
                        subject: "Physics",
                        maxMarks: 80,
                        duration: "3 Hours",
                        badge: "Revision 1 Blueprint",
                        sections: (window.MockData && window.MockData.physicsRevision1Template) ? window.MockData.physicsRevision1Template.sections : [
                            { id: "sec_a", letter: "A", name: "Section A", title: "Section A - Revision 1 Objectives (MCQ 40 × 1 = 40)", qStartNo: 1, qEndNo: 40, qCount: 40, marksPerQ: 1, maxMarks: 40, secTotal: 40 },
                            { id: "sec_b", letter: "B", name: "Section B", title: "Section B - Subjective I (5 × 2 = 10 Marks)", qStartNo: 41, qEndNo: 45, qCount: 5, marksPerQ: 2, maxMarks: 10, secTotal: 10 },
                            { id: "sec_c", letter: "C", name: "Section C", title: "Section C - Subjective II (4 × 3 = 12 Marks)", qStartNo: 46, qEndNo: 49, qCount: 4, marksPerQ: 3, maxMarks: 12, secTotal: 12 },
                            { id: "sec_d", letter: "D", name: "Section D", title: "Section D - Subjective III (2 × 5 = 10 Marks)", qStartNo: 50, qEndNo: 51, qCount: 2, marksPerQ: 5, maxMarks: 10, secTotal: 10 },
                            { id: "sec_e", letter: "E", name: "Section E", title: "Section E - Subjective IV Case Study (2 × 4 = 8 Marks)", qStartNo: 52, qEndNo: 53, qCount: 2, marksPerQ: 4, maxMarks: 8, secTotal: 8 }
                        ],
                        questions: (window.MockData && window.MockData.physicsRevision1Template) ? window.MockData.physicsRevision1Template.questions : []
                    },
                    {
                        id: "phy-mid-50",
                        name: "Physics Mid-Term Exam (50 Marks)",
                        examName: "Physics Half-Yearly Assessment",
                        maxMarks: 50,
                        duration: "2 Hours",
                        badge: "Standard",
                        questions: [
                            { qNumber: "Q1", maxMarks: 5, topic: "Electrostatics & Potential" },
                            { qNumber: "Q2", maxMarks: 5, topic: "Current & Circuits" },
                            { qNumber: "Q3", maxMarks: 10, topic: "Magnetic Field & Ampere's Law" },
                            { qNumber: "Q4", maxMarks: 15, topic: "Electromagnetic Induction & AC" },
                            { qNumber: "Q5", maxMarks: 15, topic: "Ray Optics & Instruments" }
                        ]
                    },
                    {
                        id: "phy-unit-25",
                        name: "Physics Unit Test (25 Marks)",
                        examName: "Unit Test 1 – Physics",
                        maxMarks: 25,
                        duration: "45 Mins",
                        badge: "Formative",
                        questions: [
                            { qNumber: "Q1", maxMarks: 5, topic: "Electric Flux & Gauss Theorem" },
                            { qNumber: "Q2", maxMarks: 5, topic: "Capacitor Networks" },
                            { qNumber: "Q3", maxMarks: 5, topic: "Potentiometer & Meter Bridge" },
                            { qNumber: "Q4", maxMarks: 10, topic: "Kirchhoff Circuit Laws" }
                        ]
                    }
                ]
            },
            {
                id: "pol",
                name: "Political Science",
                code: "POL-301",
                badge: "Official Blueprint",
                description: "Political Science Board Assessment (40 MCQs + 40 Marks Subjective / 80 Marks)",
                templates: [
                    window.MockData && window.MockData.politicalScienceTemplate ? window.MockData.politicalScienceTemplate : {
                        id: "pol-cbse-80",
                        name: "Political Science (80 Marks: 40 MCQs + 40 Subjective)",
                        examName: "Annual Political Science Assessment 2026",
                        subject: "Political Science",
                        maxMarks: 80,
                        duration: "3 Hours",
                        badge: "Official Blueprint",
                        sections: [
                            { id: "sec_a", letter: "A", name: "Section A", title: "Section A - Objective MCQs (Q1 to Q40)", qStartNo: 1, qEndNo: 40, qCount: 40, marksPerQ: 1, maxMarks: 40, secTotal: 40 },
                            { id: "sec_b", letter: "B", name: "Section B", title: "Section B - Short Answer I (4 × 2 = 8 Marks)", qStartNo: 41, qEndNo: 44, qCount: 4, marksPerQ: 2, maxMarks: 8, secTotal: 8 },
                            { id: "sec_c", letter: "C", name: "Section C", title: "Section C - Short Answer II (3 × 4 = 12 Marks)", qStartNo: 45, qEndNo: 47, qCount: 3, marksPerQ: 4, maxMarks: 12, secTotal: 12 },
                            { id: "sec_d", letter: "D", name: "Section D", title: "Section D - Map / Cartoon / Passage (2 × 4 = 8 Marks)", qStartNo: 48, qEndNo: 49, qCount: 2, marksPerQ: 4, maxMarks: 8, secTotal: 8 },
                            { id: "sec_e", letter: "E", name: "Section E", title: "Section E - Long Answer (2 × 6 = 12 Marks)", qStartNo: 50, qEndNo: 51, qCount: 2, marksPerQ: 6, maxMarks: 12, secTotal: 12 }
                        ],
                        questions: []
                    }
                ]
            },
            {
                id: "eco",
                name: "Economics",
                code: "ECO-301",
                badge: "Official Blueprint",
                description: "Economics Board Assessment (40 MCQs + 40 Marks Subjective / 80 Marks)",
                templates: [
                    window.MockData && window.MockData.economicsTemplate ? window.MockData.economicsTemplate : {
                        id: "eco-cbse-80",
                        name: "Economics (80 Marks: 40 MCQs + 40 Subjective)",
                        examName: "Annual Economics Assessment 2026",
                        subject: "Economics",
                        maxMarks: 80,
                        duration: "3 Hours",
                        badge: "Official Blueprint",
                        sections: [
                            { id: "sec_a", letter: "A", name: "Section A", title: "Section A - Objective MCQs (Q1 to Q40)", qStartNo: 1, qEndNo: 40, qCount: 40, marksPerQ: 1, maxMarks: 40, secTotal: 40 },
                            { id: "sec_b", letter: "B", name: "Section B", title: "Section B - Short Answer I (4 × 3 = 12 Marks)", qStartNo: 41, qEndNo: 44, qCount: 4, marksPerQ: 3, maxMarks: 12, secTotal: 12 },
                            { id: "sec_c", letter: "C", name: "Section C", title: "Section C - Short Answer II (4 × 4 = 16 Marks)", qStartNo: 45, qEndNo: 48, qCount: 4, marksPerQ: 4, maxMarks: 16, secTotal: 16 },
                            { id: "sec_d", letter: "D", name: "Section D", title: "Section D - Long Answer (2 × 6 = 12 Marks)", qStartNo: 49, qEndNo: 50, qCount: 2, marksPerQ: 6, maxMarks: 12, secTotal: 12 }
                        ],
                        questions: []
                    }
                ]
            },
            {
                id: "his",
                name: "History",
                code: "HIS-301",
                badge: "Revision 1 Blueprint",
                description: "Grade 12 History Board Assessment (40 MCQs + 40 Marks Subjective / 80 Marks)",
                templates: [
                    window.MockData && window.MockData.historyRevision1Template ? window.MockData.historyRevision1Template : {
                        id: "his-rev1-80",
                        name: "Grade 12 History Revision 1 (80 Marks)",
                        examName: "Grade 12 History Revision 1 Assessment 2026",
                        subject: "History",
                        maxMarks: 80,
                        duration: "3 Hours",
                        badge: "Revision 1 Blueprint",
                        sections: [
                            { id: "sec_a", letter: "A", name: "Section A", title: "Section A - Revision 1 Objectives (MCQ 40 × 1 = 40)", qStartNo: 1, qEndNo: 40, qCount: 40, marksPerQ: 1, maxMarks: 40, secTotal: 40 },
                            { id: "sec_b", letter: "B", name: "Section B", title: "Section B - Subjective I (3 Marks × 5 = 15 Marks)", qStartNo: 41, qEndNo: 45, qCount: 5, marksPerQ: 3, maxMarks: 15, secTotal: 15 },
                            { id: "sec_c", letter: "C", name: "Section C", title: "Section C - Subjective II (8 Marks × 2 = 16 Marks)", qStartNo: 46, qEndNo: 47, qCount: 2, marksPerQ: 8, maxMarks: 16, secTotal: 16 },
                            { id: "sec_d", letter: "D", name: "Section D", title: "Section D - Subjective III Case Study (3 Marks × 3 = 9 Marks)", qStartNo: 48, qEndNo: 50, qCount: 3, marksPerQ: 3, maxMarks: 9, secTotal: 9 }
                        ],
                        questions: []
                    }
                ]
            },
            {
                id: "soc",
                name: "Social Science",
                code: "SOC-101",
                badge: "Revision 1 Blueprint",
                description: "Grade X Social Science Revision 1 Assessment (40 MCQs + 40 Marks Subjective / 80 Marks)",
                templates: [
                    window.MockData && window.MockData.socialGrade10Revision1Template ? window.MockData.socialGrade10Revision1Template : {
                        id: "soc-x-rev1-80",
                        name: "Grade X Social Revision 1 (80 Marks)",
                        examName: "Grade X Social Science Revision 1 Assessment 2026",
                        subject: "Social Science",
                        maxMarks: 80,
                        duration: "3 Hours",
                        badge: "Revision 1 Blueprint",
                        sections: [
                            { id: "sec_a", letter: "A", name: "Section A", title: "Section A - Revision 1 Objectives (MCQ 40 × 1 = 40)", qStartNo: 1, qEndNo: 40, qCount: 40, marksPerQ: 1, maxMarks: 40, secTotal: 40 },
                            { id: "sec_b", letter: "B", name: "Section B", title: "Section B - Subjective I (2 Marks × 3 = 6 Marks)", qStartNo: 41, qEndNo: 43, qCount: 3, marksPerQ: 2, maxMarks: 6, secTotal: 6 },
                            { id: "sec_c", letter: "C", name: "Section C", title: "Section C - Subjective II (3 Marks × 5 = 15 Marks)", qStartNo: 44, qEndNo: 48, qCount: 5, marksPerQ: 3, maxMarks: 15, secTotal: 15 },
                            { id: "sec_d", letter: "D", name: "Section D", title: "Section D - Subjective III (5 Marks × 3 = 15 Marks)", qStartNo: 49, qEndNo: 51, qCount: 3, marksPerQ: 5, maxMarks: 15, secTotal: 15 },
                            { id: "sec_e", letter: "E", name: "Section E", title: "Section E - Subjective IV Case Study (4 Marks × 1 = 4 Marks)", qStartNo: 52, qEndNo: 52, qCount: 1, marksPerQ: 4, maxMarks: 4, secTotal: 4 }
                        ],
                        questions: []
                    }
                ]
            },
            {
                id: "eng",
                name: "English",
                code: "ENG-301",
                badge: "2 Templates",
                description: "English Core & Revision Assessment (80 Marks)",
                templates: [
                    window.MockData && window.MockData.englishGrade12ObjSubjTemplate ? window.MockData.englishGrade12ObjSubjTemplate : {
                        id: "eng-xii-rev-80",
                        name: "Grade XII English (80 Marks: 40 Objective + 40 Subjective)",
                        examName: "Grade XII English Assessment 2026",
                        subject: "English",
                        maxMarks: 80,
                        duration: "3 Hours",
                        badge: "Official Blueprint",
                        sections: [
                            { id: "sec_a", letter: "A", name: "Section A", title: "Section A - Objective (MCQs & Fill ups – 40 Marks)", qStartNo: 1, qEndNo: 40, qCount: 40, marksPerQ: 1, maxMarks: 40, secTotal: 40 },
                            { id: "sec_b", letter: "B", name: "Section B", title: "Section B - Subjective One Mark Fill Ups (10 × 1 = 10 Marks)", qStartNo: 41, qEndNo: 50, qCount: 10, marksPerQ: 1, maxMarks: 10, secTotal: 10 },
                            { id: "sec_c", letter: "C", name: "Section C", title: "Section C - Subjective Short Answer (2 Marks × 5 = 10 Marks)", qStartNo: 51, qEndNo: 55, qCount: 5, marksPerQ: 2, maxMarks: 10, secTotal: 10 },
                            { id: "sec_d", letter: "D", name: "Section D", title: "Section D - Subjective Long Answer (5 Marks × 4 = 20 Marks)", qStartNo: 56, qEndNo: 59, qCount: 4, marksPerQ: 5, maxMarks: 20, secTotal: 20 }
                        ],
                        questions: []
                    },
                    window.MockData && window.MockData.englishTemplate ? window.MockData.englishTemplate : {
                        id: "eng-core-cbse-80",
                        name: "English Core Board Paper (13 Qs / 80 Marks)",
                        examName: "Annual English Core Board Assessment 2026",
                        subject: "English",
                        maxMarks: 80,
                        duration: "3 Hours",
                        badge: "Official CBSE Blueprint",
                        sections: [
                            { id: "sec_a", letter: "A", name: "Section A", title: "Section A (Reading Skills – 22 Marks)", qStartNo: 1, qEndNo: 2, qCount: 2, maxMarks: 22, secTotal: 22 },
                            { id: "sec_b", letter: "B", name: "Section B", title: "Section B (Creative Writing Skills – 18 Marks)", qStartNo: 3, qEndNo: 6, qCount: 4, maxMarks: 18, secTotal: 18 },
                            { id: "sec_c", letter: "C", name: "Section C", title: "Section C (Literature – 40 Marks)", qStartNo: 7, qEndNo: 13, qCount: 7, maxMarks: 40, secTotal: 40 }
                        ],
                        questions: [
                            { id: "eng_q1", qNo: 1, qNumber: "Q1", label: "Q1", maxMarks: 12, section: "Section A (Reading Skills – 22 Marks)", sectionId: "sec_a", topic: "Unseen Passage (12 Marks)" },
                            { id: "eng_q2", qNo: 2, qNumber: "Q2", label: "Q2", maxMarks: 10, section: "Section A (Reading Skills – 22 Marks)", sectionId: "sec_a", topic: "Case-Based Unseen Passage (10 Marks)" },
                            { id: "eng_q3", qNo: 3, qNumber: "Q3", label: "Q3", maxMarks: 4, section: "Section B (Creative Writing Skills – 18 Marks)", sectionId: "sec_b", topic: "Short Writing – Notice (4 Marks)" },
                            { id: "eng_q4", qNo: 4, qNumber: "Q4", label: "Q4", maxMarks: 4, section: "Section B (Creative Writing Skills – 18 Marks)", sectionId: "sec_b", topic: "Short Writing – Invitation / Reply (4 Marks)" },
                            { id: "eng_q5", qNo: 5, qNumber: "Q5", label: "Q5", maxMarks: 5, section: "Section B (Creative Writing Skills – 18 Marks)", sectionId: "sec_b", topic: "Long Writing – Letter Writing (5 Marks)" },
                            { id: "eng_q6", qNo: 6, qNumber: "Q6", label: "Q6", maxMarks: 5, section: "Section B (Creative Writing Skills – 18 Marks)", sectionId: "sec_b", topic: "Long Writing – Article / Report Writing (5 Marks)" },
                            { id: "eng_q7", qNo: 7, qNumber: "Q7", label: "Q7", maxMarks: 6, section: "Section C (Literature – 40 Marks)", sectionId: "sec_c", topic: "Extract – Flamingo Poetry (6 Marks)" },
                            { id: "eng_q8", qNo: 8, qNumber: "Q8", label: "Q8", maxMarks: 4, section: "Section C (Literature – 40 Marks)", sectionId: "sec_c", topic: "Extract – Vistas Prose (4 Marks)" },
                            { id: "eng_q9", qNo: 9, qNumber: "Q9", label: "Q9", maxMarks: 6, section: "Section C (Literature – 40 Marks)", sectionId: "sec_c", topic: "Extract – Flamingo Prose (6 Marks)" },
                            { id: "eng_q10", qNo: 10, qNumber: "Q10", label: "Q10", maxMarks: 10, section: "Section C (Literature – 40 Marks)", sectionId: "sec_c", topic: "Short Answer – Flamingo (5 of 6, 2 Marks each = 10 Marks)" },
                            { id: "eng_q11", qNo: 11, qNumber: "Q11", label: "Q11", maxMarks: 4, section: "Section C (Literature – 40 Marks)", sectionId: "sec_c", topic: "Short Answer – Vistas (2 of 3, 2 Marks each = 4 Marks)" },
                            { id: "eng_q12", qNo: 12, qNumber: "Q12", label: "Q12", maxMarks: 5, section: "Section C (Literature – 40 Marks)", sectionId: "sec_c", topic: "Long Answer – Flamingo (5 Marks)" },
                            { id: "eng_q13", qNo: 13, qNumber: "Q13", label: "Q13", maxMarks: 5, section: "Section C (Literature – 40 Marks)", sectionId: "sec_c", topic: "Long Answer – Vistas (5 Marks)" }
                        ]
                    }
                ]
            }
        ];

        // Available Classes (Class 12-A, 12-B, 12-C, 12-D as primary classes)
        this.classes = [
            { id: "12-A", name: "Class 12", section: "A", label: "Class 12-A", studentsCount: "25 Enrolled", stream: "Science & Mathematics" },
            { id: "12-B", name: "Class 12", section: "B", label: "Class 12-B", studentsCount: "25 Enrolled", stream: "Science & Biology" },
            { id: "12-C", name: "Class 12", section: "C", label: "Class 12-C", studentsCount: "25 Enrolled", stream: "Commerce & Statistics" },
            { id: "12-D", name: "Class 12", section: "D", label: "Class 12-D", studentsCount: "25 Enrolled", stream: "Humanities & English" },
            { id: "10-A", name: "Class 10", section: "A", label: "Class 10-A", studentsCount: "25 Enrolled", stream: "General High School" },
            { id: "10-B", name: "Class 10", section: "B", label: "Class 10-B", studentsCount: "25 Enrolled", stream: "General High School" }
        ];

        // Class Roster & Reconciliation State
        this.currentClassRoster = [];
        this.rosterFilter = "all"; // "all" | "missing" | "present"
        this.manualCheckedRolls = new Set();
        this.activeTargetStudentForUpload = null;
    }

    getSubjectColor(sub) {
        if (!sub) return "#5856D6";
        const id = String(sub.id || "").toLowerCase();
        const name = String(sub.name || "").toLowerCase();
        if (id.includes("phy") || name.includes("physic")) return "#5856D6";
        if (id.includes("chem") || name.includes("chem")) return "#FF9500";
        if (id.includes("bio") || name.includes("bio")) return "#34C759";
        if (id.includes("math") || name.includes("math")) return "#007AFF";
        if (id.includes("eng") || name.includes("english")) return "#0284C7";
        if (id.includes("pol") || name.includes("politic")) return "#8B5CF6";
        if (id.includes("eco") || name.includes("econom")) return "#10B981";
        if (id.includes("his") || name.includes("histor")) return "#D97706";
        if (id.includes("soc") || name.includes("social")) return "#EA580C";
        return "#5856D6";
    }

    getSubjectIcon(sub) {
        const color = this.getSubjectColor(sub);
        const id = String(sub?.id || "").toLowerCase();
        const name = String(sub?.name || "").toLowerCase();
        if (id.includes("phy") || name.includes("physic")) {
            return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20M5 5l14 14M5 19L19 5"/></svg>`;
        }
        if (id.includes("chem") || name.includes("chem")) {
            return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31L4.1 19.3A2 2 0 0 0 5.8 22h12.4a2 2 0 0 0 1.7-2.7L14 9.31V2h-4z"/><line x1="8.5" y1="2" x2="15.5" y2="2"/></svg>`;
        }
        if (id.includes("bio") || name.includes("bio")) {
            return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22s5.5-1.5 8-6 2-8 2-8-3.5-.5-8 2-2 12-2 12z"/><path d="M12 8s3.5-.5 8 2 2 12 2 12-5.5-1.5-8-6"/></svg>`;
        }
        if (id.includes("pol") || name.includes("politic")) {
            return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.93V18a1 1 0 0 1-2 0v-1.07A7 7 0 0 1 5.07 11H6a1 1 0 0 1 0-2h-.93A7 7 0 0 1 11 3.07V4a1 1 0 0 1 2 0v-.93A7 7 0 0 1 18.93 9H18a1 1 0 0 1 0 2h.93A7 7 0 0 1 13 16.93z"/></svg>`;
        }
        if (id.includes("eco") || name.includes("econom")) {
            return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
        }
        if (id.includes("his") || name.includes("histor")) {
            return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
        }
        if (id.includes("soc") || name.includes("social")) {
            return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
        }
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
    }

    loadManualChecks() {
        this.manualCheckedRolls = new Set();
        if (!this.selectedClass) return;
        const subId = this.selectedSubject ? this.selectedSubject.id : "all";
        const key = `niprak_recon_checked_${this.selectedClass.id}_${subId}`;
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                    this.manualCheckedRolls = new Set(arr.map(r => String(r).trim()));
                }
            }
        } catch (e) {}
    }

    saveManualChecks() {
        if (!this.selectedClass) return;
        const subId = this.selectedSubject ? this.selectedSubject.id : "all";
        const key = `niprak_recon_checked_${this.selectedClass.id}_${subId}`;
        try {
            localStorage.setItem(key, JSON.stringify(Array.from(this.manualCheckedRolls)));
        } catch (e) {}
    }

    openCleanUpConfirmationModal() {
        let modalEl = document.getElementById("modal-cleanup-unwanted-confirm");
        if (!modalEl) {
            modalEl = document.createElement("div");
            modalEl.id = "modal-cleanup-unwanted-confirm";
            modalEl.className = "modal-backdrop active";
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="modal-dialog custom-delete-modal-dialog" style="max-width: 480px; padding: 28px; background: var(--bg-card); border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
                <div class="delete-icon-ring" style="width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; background: rgba(239, 68, 68, 0.1); border: 2px solid rgba(239, 68, 68, 0.25);">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                </div>
                <h3 class="delete-modal-title" style="color: var(--text-main); font-size: 1.3rem; font-weight: 600; text-align: center; margin-bottom: 8px;">Clean Up Unwanted / Demo Data</h3>
                <p class="delete-modal-msg" style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.6; text-align: center; margin-bottom: 24px;">
                    This will permanently remove all test/mock evaluations, demo mathematics papers, and the <strong>5 Dharnish</strong> test paper from browser storage and cloud sync.
                    <br><br>
                    Your official blueprints, Physics question paper templates, and student rosters will remain completely intact.
                </p>
                <div class="delete-modal-actions" style="display: flex; gap: 12px; justify-content: center;">
                    <button type="button" class="btn-secondary" id="btn-cancel-cleanup-modal" style="padding: 10px 20px; border-radius: 10px; cursor: pointer; font-size: 0.88rem;">Cancel</button>
                    <button type="button" class="btn-danger-confirm" id="btn-confirm-cleanup-modal" style="background: #DC2626; color: #fff; border: none; padding: 10px 22px; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 0.88rem;">Clean Up Now</button>
                </div>
            </div>
        `;
        modalEl.classList.add("active");

        const cancelBtn = modalEl.querySelector("#btn-cancel-cleanup-modal");
        const confirmBtn = modalEl.querySelector("#btn-confirm-cleanup-modal");

        const closeModal = () => {
            modalEl.classList.remove("active");
            modalEl.remove();
        };

        cancelBtn.addEventListener("click", closeModal);
        modalEl.addEventListener("click", (e) => {
            if (e.target === modalEl) closeModal();
        });

        confirmBtn.addEventListener("click", async () => {
            confirmBtn.disabled = true;
            confirmBtn.textContent = "Cleaning...";
            if (window.appStorage && typeof window.appStorage.purgeUnwantedData === "function") {
                await window.appStorage.purgeUnwantedData();
            }
            this.fileQueue = [];
            await this.loadExistingClassPapers();
            this.updateStepView();
            closeModal();
            if (window.app && window.app.showToast) {
                window.app.showToast("✓ Cleaned up unwanted test data and Dharnish records successfully!", "success");
            }
            if (window.app && typeof window.app.updateStorageQuotaDisplay === "function") {
                window.app.updateStorageQuotaDisplay();
            }
        });
    }

    async init() {
        if (window.appStorage) {
            const savedCatalog = await window.appStorage.getSubjectCatalog();
            if (savedCatalog && Array.isArray(savedCatalog) && savedCatalog.length > 0) {
                // Ensure Physics exists with its standard templates
                let phySub = savedCatalog.find(s => s.id === "phy" || (s.name && s.name.toLowerCase().includes("physic")));
                const defaultPhy = this.catalog.find(s => s.id === "phy");
                if (!phySub) {
                    if (defaultPhy) savedCatalog.unshift(defaultPhy);
                } else if (defaultPhy && defaultPhy.templates) {
                    // Ensure Grade 12 Physics Revision 1 template exists in Physics
                    defaultPhy.templates.forEach(defTpl => {
                        if (!phySub.templates) phySub.templates = [];
                        const existingTpl = phySub.templates.find(t => t.id === defTpl.id || t.name === defTpl.name);
                        if (!existingTpl) {
                            phySub.templates.push(defTpl);
                        }
                    });
                }

                // Ensure Political Science exists with its official blueprint
                const hasPol = savedCatalog.some(s => s.id === "pol" || (s.name && s.name.toLowerCase().includes("political")));
                if (!hasPol) {
                    const defaultPol = this.catalog.find(s => s.id === "pol");
                    if (defaultPol) savedCatalog.push(defaultPol);
                }

                // Ensure Economics exists with its official blueprint
                const hasEco = savedCatalog.some(s => s.id === "eco" || (s.name && s.name.toLowerCase().includes("economic")));
                if (!hasEco) {
                    const defaultEco = this.catalog.find(s => s.id === "eco");
                    if (defaultEco) savedCatalog.push(defaultEco);
                }

                // Ensure History exists with its official blueprint
                const hasHis = savedCatalog.some(s => s.id === "his" || (s.name && s.name.toLowerCase().includes("histor")));
                if (!hasHis) {
                    const defaultHis = this.catalog.find(s => s.id === "his");
                    if (defaultHis) savedCatalog.push(defaultHis);
                }

                // Ensure Social Science exists with its official blueprint
                const hasSoc = savedCatalog.some(s => s.id === "soc" || (s.name && s.name.toLowerCase().includes("social")));
                if (!hasSoc) {
                    const defaultSoc = this.catalog.find(s => s.id === "soc");
                    if (defaultSoc) savedCatalog.push(defaultSoc);
                }

                // Ensure English exists with all its templates (including Grade XII English Revision)
                let engSub = savedCatalog.find(s => s.id === "eng" || (s.name && s.name.toLowerCase().includes("english")));
                const defaultEng = this.catalog.find(s => s.id === "eng");
                if (!engSub) {
                    if (defaultEng) savedCatalog.push(defaultEng);
                } else if (defaultEng && defaultEng.templates) {
                    defaultEng.templates.forEach(defTpl => {
                        if (!engSub.templates) engSub.templates = [];
                        const existingTpl = engSub.templates.find(t => t.id === defTpl.id || t.name === defTpl.name);
                        if (!existingTpl) {
                            engSub.templates.unshift(defTpl);
                        }
                    });
                }

                // Dynamically ensure all subjects have accurate badge labels
                savedCatalog.forEach(sub => {
                    const tplCount = (sub.templates && Array.isArray(sub.templates)) ? sub.templates.length : 0;
                    sub.badge = tplCount === 1 ? "1 Template" : `${tplCount} Templates`;
                });

                this.catalog = savedCatalog;
                await window.appStorage.saveSubjectCatalog(this.catalog);
            } else {
                // First-time run: use full default catalog (Physics + English built-in templates)
                this.catalog.forEach(sub => {
                    const tplCount = (sub.templates && Array.isArray(sub.templates)) ? sub.templates.length : 0;
                    sub.badge = tplCount === 1 ? "1 Template" : `${tplCount} Templates`;
                });
                await window.appStorage.saveSubjectCatalog(this.catalog);
            }

            // Uploader desk must ALWAYS have access to all classes for exam uploading
            const savedClasses = await window.appStorage.getClassesList();
            if (savedClasses && Array.isArray(savedClasses) && savedClasses.length > 0) {
                this.classes = savedClasses;
            }

            // Update dynamic student counts for all classes from actual rosters
            for (const cls of this.classes) {
                try {
                    const roster = await window.appStorage.getClassRoster(cls.id);
                    cls.studentsCount = (roster && roster.length > 0) ? `${roster.length} Enrolled` : `0 Enrolled`;
                } catch (e) {
                    cls.studentsCount = `0 Enrolled`;
                }
            }
        }
        this.render();
        this.bindEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="upload-portal-page">
                <!-- Top Hub Title -->
                <div class="upload-portal-header">
                    <div>
                        <div class="portal-badge-row">
                            <span class="portal-role-tag">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                Exam Department Upload Desk
                            </span>
                        </div>
                        <h2 class="upload-portal-title">Batch Answer Sheet Uploader</h2>
                        <p class="upload-portal-subtitle">Select Subject, Exam Template, and Class to upload student answer sheet PDF documents for digital correction.</p>
                    </div>

                    <div class="upload-portal-actions">
                        <button type="button" class="btn-portal-evaluator" id="btn-goto-evaluator">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            Go to Teacher Evaluator Desk
                        </button>
                    </div>
                </div>

                <!-- Upload Desk Layout: Side Menu Bar + Main Content -->
                <div class="upload-desk-layout">
                    <!-- Upload Desk Dedicated Side Menu Bar -->
                    <aside class="upload-desk-sidebar">
                        <div class="upload-side-section-title">INGESTION STEPS</div>
                        <ul class="upload-side-menu-list">
                            <li class="upload-side-step ${this.currentStep === 1 ? 'active' : ''} ${this.currentStep > 1 ? 'completed' : ''}" data-step="1">
                                <span class="step-circle">1</span>
                                <div class="step-meta">
                                    <span class="step-meta-label">Subject</span>
                                    <span class="step-meta-val" id="side-bc-subject-val">${this.selectedSubject ? this.selectedSubject.name : 'Choose Subject'}</span>
                                </div>
                            </li>
                            <li class="upload-side-step ${this.currentStep === 2 ? 'active' : ''} ${this.currentStep > 2 ? 'completed' : ''} ${!this.selectedSubject ? 'disabled' : ''}" data-step="2">
                                <span class="step-circle">2</span>
                                <div class="step-meta">
                                    <span class="step-meta-label">Exam Template</span>
                                    <span class="step-meta-val" id="side-bc-template-val">${this.selectedTemplate ? this.selectedTemplate.name : 'Choose Template'}</span>
                                </div>
                            </li>
                            <li class="upload-side-step ${this.currentStep === 3 ? 'active' : ''} ${this.currentStep > 3 ? 'completed' : ''} ${!this.selectedTemplate ? 'disabled' : ''}" data-step="3">
                                <span class="step-circle">3</span>
                                <div class="step-meta">
                                    <span class="step-meta-label">Class & Section</span>
                                    <span class="step-meta-val" id="side-bc-class-val">${this.selectedClass ? this.selectedClass.label : 'Choose Class'}</span>
                                </div>
                            </li>
                            <li class="upload-side-step ${this.currentStep === 4 ? 'active' : ''} ${!this.selectedClass ? 'disabled' : ''}" data-step="4">
                                <span class="step-circle">4</span>
                                <div class="step-meta">
                                    <span class="step-meta-label">Upload PDFs</span>
                                    <span class="step-meta-val">Ingestion & Preview</span>
                                </div>
                            </li>
                        </ul>

                        <!-- Quick Subject Selector in Upload Side Menu -->
                        <div class="upload-side-section-title" style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center;">
                            <span>ACTIVE SUBJECTS</span>
                        </div>
                        <div class="upload-side-subjects-list">
                            ${this.catalog.map(sub => `
                                <button type="button" class="upload-side-subject-btn ${this.selectedSubject && this.selectedSubject.id === sub.id ? 'active' : ''}" data-subject-id="${sub.id}">
                                    <span class="subj-bullet" style="background: ${this.getSubjectColor(sub)};"></span>
                                    <span class="subj-name">${sub.name}</span>
                                    <span class="subj-code-tag">${sub.code}</span>
                                </button>
                            `).join('')}
                            <button type="button" class="upload-side-subject-btn btn-create-subject-trigger" style="border: 1px dashed rgba(0, 113, 227, 0.4); color: #0071E3; font-weight: 500; justify-content: center; margin-top: 6px;" title="Create New Subject">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                <span>+ New Subject</span>
                            </button>
                        </div>

                        <!-- Ingestion Queue Summary Card in Side Menu -->
                        <div class="upload-side-queue-card">
                            <div class="side-queue-title">Queue Status</div>
                            <div class="side-queue-stat">
                                <span class="queue-stat-num">${this.fileQueue.length}</span>
                                <span class="queue-stat-desc">Documents staged</span>
                            </div>
                            ${this.fileQueue.length > 0 ? `
                                <button type="button" class="btn-side-publish" id="btn-side-publish-queue">
                                    Publish Batch (${this.fileQueue.length})
                                </button>
                            ` : ''}
                        </div>
                    </aside>

                    <!-- Main Upload Content Area -->
                    <div class="upload-desk-main">
                        <!-- Breadcrumb Stepper Trail -->
                        <div class="portal-breadcrumb-card">
                            <div class="breadcrumb-step ${this.currentStep >= 1 ? 'step-active' : ''}" data-step="1">
                                <span class="breadcrumb-num">1</span>
                                <div class="breadcrumb-text">
                                    <span class="breadcrumb-label">Subject</span>
                                    <span class="breadcrumb-val" id="bc-subject-val">${this.selectedSubject ? this.selectedSubject.name : 'Choose Subject'}</span>
                                </div>
                            </div>

                            <span class="breadcrumb-sep">/</span>

                            <div class="breadcrumb-step ${this.currentStep >= 2 ? 'step-active' : ''} ${!this.selectedSubject ? 'step-disabled' : ''}" data-step="2">
                                <span class="breadcrumb-num">2</span>
                                <div class="breadcrumb-text">
                                    <span class="breadcrumb-label">Template</span>
                                    <span class="breadcrumb-val" id="bc-template-val">${this.selectedTemplate ? this.selectedTemplate.name : 'Choose Template'}</span>
                                </div>
                            </div>

                            <span class="breadcrumb-sep">/</span>

                            <div class="breadcrumb-step ${this.currentStep >= 3 ? 'step-active' : ''} ${!this.selectedTemplate ? 'step-disabled' : ''}" data-step="3">
                                <span class="breadcrumb-num">3</span>
                                <div class="breadcrumb-text">
                                    <span class="breadcrumb-label">Class</span>
                                    <span class="breadcrumb-val" id="bc-class-val">${this.selectedClass ? this.selectedClass.label : 'Choose Class'}</span>
                                </div>
                            </div>

                            <span class="breadcrumb-sep">/</span>

                            <div class="breadcrumb-step ${this.currentStep >= 4 ? 'step-active' : ''} ${!this.selectedClass ? 'step-disabled' : ''}" data-step="4">
                                <span class="breadcrumb-num">4</span>
                                <div class="breadcrumb-text">
                                    <span class="breadcrumb-label">Upload PDFs</span>
                                    <span class="breadcrumb-val">Ingestion & Preview</span>
                                </div>
                            </div>
                        </div>

                        <!-- Step Content Container -->
                        <div id="portal-step-content-area" class="portal-step-container">
                            ${this.renderCurrentStepContent()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderCurrentStepContent() {
        switch (this.currentStep) {
            case 1:
                return this.renderStep1Subjects();
            case 2:
                return this.renderStep2Templates();
            case 3:
                return this.renderStep3Classes();
            case 4:
                return this.renderStep4UploadStudio();
            default:
                return this.renderStep1Subjects();
        }
    }

    // --- Step 1: Subjects Grid ---
    renderStep1Subjects() {
        return `
            <div class="step-view-block animate-fade-in">
                <div class="step-header-intro-row" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
                    <div class="step-header-intro" style="margin-bottom: 0;">
                        <span class="step-badge">Step 1 of 4 • Subject Catalog</span>
                        <h3 class="step-title">Select Subject</h3>
                        <p class="step-desc">Pick an active subject to browse its exam templates, or click <strong>+ Create Subject</strong> to add a new subject.</p>
                    </div>
                    <button type="button" class="btn-primary btn-create-subject-trigger" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; font-weight: 600; border-radius: 10px; cursor: pointer; background: #0071E3; color: #fff; border: none; box-shadow: 0 4px 12px rgba(0, 113, 227, 0.25); font-size: 14px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        + Create Subject
                    </button>
                </div>

                <div class="subjects-grid">
                    ${this.catalog.map(sub => {
                        const tplCount = (sub.templates && Array.isArray(sub.templates)) ? sub.templates.length : 0;
                        const badgeText = tplCount === 1 ? '1 Template' : `${tplCount} Templates`;
                        return `
                        <div class="subject-card ${this.selectedSubject && this.selectedSubject.id === sub.id ? 'selected' : ''}" data-subject-id="${sub.id}">
                            <div class="subject-card-top">
                                <div class="subject-icon-box" style="background: ${this.getSubjectColor(sub)}15;">
                                    ${this.getSubjectIcon(sub)}
                                </div>
                                <span class="subject-count-badge">${badgeText}</span>
                                <div class="subject-header-actions" style="margin-left: auto; display: flex; gap: 4px;">
                                    <button type="button" class="btn-card-action btn-edit-subject" data-subject-id="${sub.id}" title="Edit Subject Details">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    </button>
                                    <button type="button" class="btn-card-action btn-delete-subject" data-subject-id="${sub.id}" title="Delete Subject">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    </button>
                                </div>
                            </div>
                            <h4 class="subject-title">${sub.name}</h4>
                            <span class="subject-code">${sub.code}</span>
                            <p class="subject-description">${sub.description}</p>
                            <div class="subject-card-footer">
                                <span class="subject-action-link">
                                    Browse Templates
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                </span>
                            </div>
                        </div>
                    `;
                    }).join('')}

                    <!-- Add New Subject Card -->
                    <div class="card-add-entity btn-create-subject-trigger" id="btn-add-subject-card" title="Add New Subject">
                        <div class="card-add-icon-ring">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </div>
                        <span class="card-add-title">Add New Subject</span>
                        <span class="card-add-sub">Create a new subject & templates</span>
                    </div>
                </div>
            </div>
        `;
    }

    // --- Step 2: Templates Grid ---
    renderStep2Templates() {
        if (!this.selectedSubject) return this.renderStep1Subjects();

        return `
            <div class="step-view-block animate-fade-in">
                <div class="step-nav-bar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <button type="button" class="btn-step-back" id="btn-back-to-step1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 5 19 12 12 5"/></svg>
                            Back to Subjects
                        </button>
                        <div class="step-header-intro" style="margin-bottom: 0;">
                            <span class="step-badge">Step 2 of 4 • ${this.selectedSubject.name}</span>
                            <h3 class="step-title">${this.selectedSubject.name} – Exam Templates</h3>
                            <p class="step-desc">Select a template to upload data for, or click <strong>+ Create Template</strong> to build a new blueprint.</p>
                        </div>
                    </div>
                    <button type="button" class="btn-primary btn-create-template-trigger" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; font-weight: 600; border-radius: 10px; cursor: pointer; background: #0071E3; color: #fff; border: none; box-shadow: 0 4px 12px rgba(0, 113, 227, 0.25); font-size: 14px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        + Create Template
                    </button>
                </div>

                <div class="templates-grid">
                    ${(this.selectedSubject.templates || []).map(tpl => {
                        let secSummary = [];
                        if (tpl.questions && tpl.questions.length > 8) {
                            const secMap = {};
                            tpl.questions.forEach(q => {
                                const secName = q.section || "Questions";
                                if (!secMap[secName]) secMap[secName] = { count: 0, marks: 0 };
                                secMap[secName].count++;
                                secMap[secName].marks += (q.maxMarks || 0);
                            });
                            secSummary = Object.keys(secMap).map(s => `${s.replace('Section ', 'Sec ')}: ${secMap[s].count} Qs (${secMap[s].marks}M)`);
                        } else if (tpl.questions) {
                            secSummary = tpl.questions.map(q => `${q.qNumber} (${q.maxMarks}m)`);
                        }

                        return `
                            <div class="template-card ${this.selectedTemplate && this.selectedTemplate.id === tpl.id ? 'selected' : ''}" data-template-id="${tpl.id}">
                                <div class="template-card-header">
                                    <span class="template-badge">${tpl.badge || 'Standard'}</span>
                                    <div class="template-header-actions" style="display: flex; align-items: center; gap: 6px;">
                                        <button type="button" class="btn-card-action btn-edit-template" data-template-id="${tpl.id}" title="Edit Exam Template Structure">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        <button type="button" class="btn-card-action btn-duplicate-template" data-template-id="${tpl.id}" title="Duplicate / Copy Template">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                        </button>
                                        <button type="button" class="btn-card-action btn-delete-template" data-template-id="${tpl.id}" title="Delete Exam Template">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        </button>
                                    </div>
                                </div>
                                <h4 class="template-title">${tpl.name}</h4>
                                <p class="template-exam-name">${tpl.examName}</p>

                                <div class="template-stats-bar">
                                    <div class="template-stat-item">
                                        <span class="stat-label">Max Marks</span>
                                        <span class="stat-val highlight">${tpl.maxMarks}</span>
                                    </div>
                                    <div class="template-stat-item">
                                        <span class="stat-label">Questions</span>
                                        <span class="stat-val">${tpl.questions ? tpl.questions.length : 0}</span>
                                    </div>
                                    <div class="template-stat-item">
                                        <span class="stat-label">Duration</span>
                                        <span class="stat-val">${tpl.duration || '3 Hours'}</span>
                                    </div>
                                </div>

                                <div class="template-questions-preview">
                                    <span class="q-preview-title">Exam Blueprint Structure:</span>
                                    <div class="q-pill-row">
                                        ${secSummary.map(tag => `
                                            <span class="q-pill">${tag}</span>
                                        `).join('')}
                                    </div>
                                </div>

                                <button type="button" class="btn-select-template">
                                    Select Template & Pick Class
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                </button>
                            </div>
                        `;
                    }).join('')}

                    <!-- Add Exam Template Card -->
                    <div class="card-add-entity btn-create-template-trigger" id="btn-add-template-card" title="Add Exam Template">
                        <div class="card-add-icon-ring">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </div>
                        <span class="card-add-title">Add Exam Template</span>
                        <span class="card-add-sub">Define marks & question structure</span>
                    </div>
                </div>
            </div>
        `;
    }

    // --- Step 3: Class Selection Grid ---
    renderStep3Classes() {
        if (!this.selectedTemplate) return this.renderStep2Templates();

        return `
            <div class="step-view-block animate-fade-in">
                <div class="step-nav-bar">
                    <button type="button" class="btn-step-back" id="btn-back-to-step2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                        Back to Templates
                    </button>
                    <div class="step-header-intro" style="margin-bottom: 0;">
                        <span class="step-badge">Step 3 of 4</span>
                        <h3 class="step-title">Select Class & Section</h3>
                        <p class="step-desc">Choose the class that completed the <span class="text-highlight">${this.selectedTemplate.name}</span> (${this.selectedSubject.name}).</p>
                    </div>
                </div>

                <div class="classes-grid">
                    ${this.classes.map(cls => `
                        <div class="class-card ${this.selectedClass && this.selectedClass.id === cls.id ? 'selected' : ''}" data-class-id="${cls.id}">
                            <div class="class-card-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            </div>
                            <div class="class-card-content">
                                <h4 class="class-title">${cls.label}</h4>
                                <span class="class-count">${cls.studentsCount}</span>
                            </div>
                            <button type="button" class="btn-select-class">
                                Proceed to Upload
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                            </button>
                        </div>
                    `).join('')}

                    <!-- Add New Class Card -->
                    <div class="card-add-entity" id="btn-add-class-card" title="Add New Class">
                        <div class="card-add-icon-ring">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </div>
                        <span class="card-add-title">Add New Class</span>
                        <span class="card-add-sub">Add section & generate roster</span>
                    </div>
                </div>
            </div>
        `;
    }

    
    async loadClassRoster() {
        if (!this.selectedClass) return;
        this.loadManualChecks();
        if (window.appStorage && typeof window.appStorage.getClassRoster === 'function') {
            this.currentClassRoster = await window.appStorage.getClassRoster(this.selectedClass.id);
        } else {
            this.currentClassRoster = this.generateFallbackRoster(this.selectedClass.id);
        }
    }

    generateFallbackRoster(classId) {
        return [];
    }

    computeReconciliation() {
        if (!this.currentClassRoster || this.currentClassRoster.length === 0) {
            if (this.selectedClass) {
                this.currentClassRoster = this.generateFallbackRoster(this.selectedClass.id);
            } else {
                this.currentClassRoster = [];
            }
        }

        if (this.manualCheckedRolls.size === 0) {
            this.loadManualChecks();
        }

        const roster = this.currentClassRoster || [];
        const queue = this.fileQueue || [];
        const existing = this.existingPapers || [];

        const list = roster.map(student => {
            const sRoll = String(student.rollNo || "").trim();
            const sName = String(student.studentName || "").toLowerCase().trim();
            const sNameParts = sName.split(/\s+/).filter(Boolean);

            // 1. Match against staged incoming file queue
            const matchedQueueItem = queue.find(q => {
                const qRoll = String(q.rollNo || "").trim();
                const qName = String(q.studentName || "").toLowerCase().trim();
                const qFileName = String(q.fileName || "").toLowerCase();

                if (qRoll && sRoll && qRoll === sRoll) return true;
                if (sRoll && (qFileName.includes(`_${sRoll}.`) || qFileName.includes(`-${sRoll}.`) || qFileName.includes(`${sRoll}_`) || qFileName.startsWith(`${sRoll} `))) return true;
                if (qName && (qName === sName || qName.includes(sName) || sName.includes(qName))) return true;
                if (sNameParts.length >= 2 && (qName.includes(sNameParts[0]) || qFileName.includes(sNameParts[0]))) return true;

                return false;
            });

            // 2. Match against existing published/saved papers for this class
            const matchedExistingItem = !matchedQueueItem ? existing.find(p => {
                const pRoll = String(p.rollNo || "").trim();
                const pName = String(p.studentName || "").toLowerCase().trim();
                const pFileName = String(p.fileName || "").toLowerCase();

                if (pRoll && sRoll && pRoll === sRoll) return true;
                if (sRoll && (pFileName.includes(`_${sRoll}.`) || pFileName.includes(`-${sRoll}.`) || pFileName.includes(`${sRoll}_`) || pFileName.startsWith(`${sRoll} `))) return true;
                if (pName && (pName === sName || pName.includes(sName) || sName.includes(pName))) return true;
                if (sNameParts.length >= 2 && (pName.includes(sNameParts[0]) || pFileName.includes(sNameParts[0]))) return true;

                return false;
            }) : null;

            const isPresent = !!matchedQueueItem || !!matchedExistingItem || (this.manualCheckedRolls && this.manualCheckedRolls.has(sRoll));

            let matchedFile = null;
            if (matchedQueueItem) {
                matchedFile = {
                    fileName: matchedQueueItem.fileName,
                    pages: matchedQueueItem.pages || [],
                    isUploaded: false
                };
            } else if (matchedExistingItem) {
                matchedFile = {
                    fileName: matchedExistingItem.fileName || `${student.studentName}_AnswerSheet.pdf`,
                    pages: new Array(matchedExistingItem.pageCount || (matchedExistingItem.pages ? matchedExistingItem.pages.length : 1)),
                    isUploaded: true
                };
            }

            return {
                ...student,
                isPresent: isPresent,
                matchedFile: matchedFile,
                isManuallyTicked: !matchedFile && this.manualCheckedRolls && this.manualCheckedRolls.has(sRoll)
            };
        });

        const totalEnrolled = roster.length;
        const presentCount = list.filter(item => item.isPresent).length;
        const missingCount = list.filter(item => !item.isPresent).length;

        return {
            students: list,
            totalEnrolled,
            presentCount,
            missingCount
        };
    }

    generateDemoCsvContent() {
        return '"Roll No","Student Name"';
    }

    downloadDemoCsvTemplate() {
        const classLabel = this.selectedClass ? this.selectedClass.label : "Class_12A";
        const csvContent = this.generateDemoCsvContent();
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${classLabel.replace(/\s+/g, '_')}_Student_Roster_Template.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    parseRosterCsv(text) {
        if (!text) return [];
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) return [];

        const newStudents = [];
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(",").map(cell => cell.replace(/^"|"$/g, "").trim());
            if (row.length >= 2 && row[1]) {
                newStudents.push({
                    rollNo: row[0] || String(1200 + i),
                    studentName: row[1]
                });
            }
        }
        return newStudents;
    }

    async handleRosterCsvUpload(file) {
        if (!file) return;
        const text = await file.text();
        const newStudents = this.parseRosterCsv(text);

        if (newStudents.length === 0) {
            alert("No valid student rows found in the CSV. Expected columns: Roll No, Student Name.");
            return;
        }

        this.currentClassRoster = newStudents;
        if (this.selectedClass && window.appStorage) {
            await window.appStorage.saveClassRoster(this.selectedClass.id, newStudents);
        }
        this.updateStepView();
        alert(`Successfully imported ${newStudents.length} students into ${this.selectedClass ? this.selectedClass.label : 'Class'}!`);
    }

    // --- Step 4: PDF Upload Studio ---
    renderStep4UploadStudio() {
        if (!this.selectedClass) return this.renderStep3Classes();

        const recon = this.computeReconciliation();
        let filteredStudents = recon.students;
        if (this.rosterFilter === 'missing') {
            filteredStudents = recon.students.filter(s => !s.isPresent);
        } else if (this.rosterFilter === 'present') {
            filteredStudents = recon.students.filter(s => s.isPresent);
        }

        return `
            <div class="step-view-block animate-fade-in">
                <div class="step-nav-bar">
                    <button type="button" class="btn-step-back" id="btn-back-to-step3">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                        Change Class
                    </button>
                    <div class="step-header-intro" style="margin-bottom: 0;">
                        <span class="step-badge">Step 4 of 4</span>
                        <h3 class="step-title">Upload Answer Sheet PDFs & Verify Submission</h3>
                        <p class="step-desc">
                            Target: <span class="target-chip">${this.selectedSubject.name}</span>
                            <span class="target-chip">${this.selectedTemplate.name} (${this.selectedTemplate.maxMarks}M)</span>
                            <span class="target-chip">${this.selectedClass.label}</span>
                        </p>
                    </div>
                </div>

                <!-- Class Roster & Bulk Student Name Import Toolbar -->
                <div class="roster-toolbar-card">
                    <div class="roster-meta-col">
                        <div class="roster-title-row">
                            <span class="roster-class-tag">${this.selectedClass.label}</span>
                            <span class="roster-stream-tag">${this.selectedClass.stream || 'Senior Secondary'}</span>
                        </div>
                        <span class="roster-enrolled-count">${recon.totalEnrolled} Students Enrolled in Class Roster</span>
                    </div>

                    <div class="roster-btn-group">
                        <button type="button" class="btn-roster-action" id="btn-download-demo-csv" title="Download Excel CSV Roster Template">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Demo Template (.csv)
                        </button>
                        <button type="button" class="btn-roster-action" id="btn-import-roster-csv" title="Upload Excel / CSV Roster">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            Import Excel / CSV
                        </button>
                        <input type="file" id="inp-roster-csv-file" accept=".csv, text/csv, text/plain" style="display:none;" />
                        <button type="button" class="btn-roster-action" id="btn-reload-demo-roster" title="Reset to standard 25-student class roster">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                            Demo 25 Roster
                        </button>
                    </div>
                </div>

                <!-- PDF Dropzone Card -->
                <div class="upload-dropzone-card">
                    <div class="pdf-dropzone" id="portal-pdf-dropzone">
                        <input type="file" id="portal-pdf-file-input" accept="application/pdf, .pdf, image/png, image/jpeg, image/jpg, image/webp, image/*" multiple style="display:none;" />
                        <input type="file" id="inp-single-student-pdf-file" accept="application/pdf, .pdf, image/png, image/jpeg, image/jpg, image/webp, image/*" style="display:none;" />
                        <div class="dropzone-icon-ring">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="12 18 12 12 9 15"/><polyline points="12 12 15 15"/></svg>
                        </div>
                        <h4 class="dropzone-heading">Drop Student Answer Sheet PDFs Here</h4>
                        <p class="dropzone-sub">Upload individual student PDFs or multiple files at once (Strict 5MB Limit per file • Auto-optimized & compressed). The system automatically reconciles files with the student roster below.</p>
                        <div class="dropzone-buttons-row">
                            <button type="button" class="btn-browse-pdf" id="btn-portal-browse-pdf">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                Browse PDF Files
                            </button>
                            <button type="button" class="btn-sample-pdf" id="btn-load-sample-student-pdf">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                Quick Generate Sample PDF
                            </button>
                        </div>
                    </div>

                    <!-- Files Processing Queue -->
                    <div class="file-queue-area" id="file-queue-container" style="display: block;">
                        <!-- Batch Upload Progress Banner -->
                        <div class="batch-upload-progress-banner" id="batch-upload-progress-banner" style="display: none;">
                            <div class="batch-progress-header">
                                <span class="batch-progress-title" id="batch-progress-title">Uploading & Ingesting Files...</span>
                                <span class="batch-progress-pct" id="batch-progress-pct">0%</span>
                            </div>
                            <div class="batch-progress-track">
                                <div class="batch-progress-fill" id="batch-progress-fill" style="width: 0%;"></div>
                            </div>
                        </div>

                        <div class="file-queue-header">
                            <h4 class="queue-title">PDF Ingestion Queue (${this.fileQueue.length} Document${this.fileQueue.length === 1 ? '' : 's'})</h4>
                            <button type="button" class="btn-clear-queue" id="btn-clear-queue" style="${this.fileQueue.length > 0 ? '' : 'display:none;'}">Clear All</button>
                        </div>

                        <div class="queue-list" id="queue-items-list">
                            ${this.renderQueueItems()}
                        </div>

                        <div class="queue-actions-footer">
                            <button type="button" class="btn-publish-eval" id="btn-publish-batch">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                <span id="btn-publish-batch-text">Publish Papers to Teacher Evaluator Desk (${this.fileQueue.filter(i => i.isReady).length} Ready)</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Student Submission Reconciliation & Missing Check Table -->
                <div class="reconciliation-card" id="reconciliation-checklist-card">
                    <div class="reconciliation-header">
                        <div>
                            <div class="reconciliation-badge-row">
                                <span class="reconciliation-tag">Submission Attendance & Checklist</span>
                                <span class="reconciliation-status-pill ${recon.missingCount === 0 ? 'status-all-present' : 'status-has-missing'}">
                                    ${recon.missingCount === 0 ? 'All 100% Papers Present' : `${recon.missingCount} Paper(s) Missing`}
                                </span>
                            </div>
                            <h4 class="reconciliation-title">${this.selectedClass.label} Answer Sheet Submission Checklist</h4>
                            <p class="reconciliation-subtitle">Check off students to confirm all answer papers are present or identify who has not yet submitted.</p>
                        </div>
                    </div>

                    <!-- Reconciliation KPI summary strip -->
                    <div class="reconciliation-kpi-row">
                        <div class="recon-kpi-chip">
                            <span class="recon-chip-label">Total Enrolled</span>
                            <span class="recon-chip-val">${recon.totalEnrolled}</span>
                        </div>
                        <div class="recon-kpi-chip chip-present">
                            <span class="recon-chip-dot"></span>
                            <span class="recon-chip-label">Papers Present</span>
                            <span class="recon-chip-val">${recon.presentCount}</span>
                        </div>
                        <div class="recon-kpi-chip chip-missing">
                            <span class="recon-chip-dot"></span>
                            <span class="recon-chip-label">Missing Papers</span>
                            <span class="recon-chip-val">${recon.missingCount}</span>
                        </div>
                        <div class="recon-filter-group">
                            <button type="button" class="btn-recon-filter ${this.rosterFilter === 'all' ? 'active' : ''}" data-filter="all">All (${recon.totalEnrolled})</button>
                            <button type="button" class="btn-recon-filter ${this.rosterFilter === 'missing' ? 'active' : ''}" data-filter="missing">Missing (${recon.missingCount})</button>
                            <button type="button" class="btn-recon-filter ${this.rosterFilter === 'present' ? 'active' : ''}" data-filter="present">Present (${recon.presentCount})</button>
                        </div>
                    </div>

                    <!-- Interactive Verification Table -->
                    <div class="reconciliation-table-wrap">
                        <table class="reconciliation-table">
                            <thead>
                                <tr>
                                    <th style="width: 54px; text-align: center;">Verify</th>
                                    <th style="width: 90px;">Roll No</th>
                                    <th>Student Name</th>
                                    <th>Submission & PDF Attachment</th>
                                    <th style="width: 140px; text-align: right;">Action</th>
                                </tr>
                            </thead>
                            <tbody class="recon-table-body">
                                ${filteredStudents.map(student => `
                                    <tr class="${student.isPresent ? 'row-present' : 'row-missing'}">
                                        <td style="text-align: center;">
                                            <input type="checkbox" class="recon-check-box" data-roll="${student.rollNo}" ${student.isPresent ? 'checked' : ''} title="Tick to verify student paper presence" />
                                        </td>
                                        <td class="font-mono">${student.rollNo}</td>
                                        <td><span class="student-name-text">${student.studentName}</span></td>
                                        <td>
                                            ${student.matchedFile ? `
                                                <div class="file-matched-chip ${student.matchedFile.isUploaded ? 'chip-saved' : ''}">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                    <span class="matched-filename">${student.matchedFile.fileName}</span>
                                                    <span class="matched-pages">(${student.matchedFile.pages.length} Pages • ${student.matchedFile.isUploaded ? 'Saved' : 'In Queue'})</span>
                                                </div>
                                            ` : (student.isManuallyTicked ? `
                                                <span class="badge-manually-verified">
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                    Manually Verified Present
                                                </span>
                                            ` : `
                                                <span class="badge-missing-alert">
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                                    Missing File
                                                </span>
                                            `)}
                                        </td>
                                        <td style="text-align: right;">
                                            ${student.isPresent ? `
                                                <span class="tag-ready-check">Present</span>
                                            ` : `
                                                <button type="button" class="btn-attach-single-pdf" data-roll="${student.rollNo}" data-name="${student.studentName}">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                                    Attach PDF
                                                </button>
                                            `}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Existing Uploaded Papers for this Class -->
                <div class="existing-papers-card" id="existing-papers-section">
                    <div class="existing-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <h4 class="existing-title">
                                Uploaded Papers in ${this.selectedClass.label} – ${this.selectedSubject.name} (${this.selectedTemplate.name})
                            </h4>
                            <span class="existing-badge" id="existing-count-badge">Loading papers...</span>
                        </div>
                        <button type="button" class="btn-clean-unwanted-data" id="btn-portal-clean-data" title="Clean up unwanted test/demo data and Dharnish records" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #DC2626; padding: 6px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 500; cursor: pointer;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            Clean Up Unwanted Data
                        </button>
                    </div>
                    <div id="existing-papers-tbody-wrap"></div>
                </div>
            </div>
        `;
    }

    renderQueueItems() {
        if (!this.fileQueue || this.fileQueue.length === 0) {
            return `
                <div class="queue-empty-placeholder" style="text-align: center; padding: 26px 20px; background: var(--bg-subtle); border: 1.5px dashed var(--border-color); border-radius: 16px; margin-bottom: 16px;">
                    <div style="font-size: 0.95rem; font-weight: 500; color: var(--text-main); margin-bottom: 4px;">No student answer sheets staged in queue</div>
                    <div style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 10px;">Drop or browse PDF answer sheets (Max 5MB each) into the dropzone above to stage them.</div>
                    <span class="publish-badge-pill pill-green" style="font-size: 0.74rem;">Strict 5MB Limit • Dynamic Image Compression • Fast Cloud Sync</span>
                </div>
            `;
        }

        return this.fileQueue.map((item, idx) => {
            const pct = item.progressPercent !== undefined ? item.progressPercent : (item.isReady ? 100 : 0);
            const statusMsg = item.statusText || (item.isProcessing ? 'Processing PDF pages...' : `${item.pages.length} Pages Extracted via PDF.js`);

            return `
                <div class="queue-item-card ${item.isReady ? 'ready' : 'processing'}" id="queue-item-card-${idx}">
                    <div class="queue-item-top">
                        <div class="queue-file-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        </div>
                        <div class="queue-file-info">
                            <span class="queue-file-name">${item.fileName}</span>
                            <span class="queue-file-pages" id="queue-status-text-${idx}">${statusMsg}</span>
                        </div>
                        <button type="button" class="btn-remove-queue-item" data-index="${idx}" title="Remove file">×</button>
                    </div>

                    <!-- Progress Bar for PDF Ingestion -->
                    <div class="queue-progress-box" id="queue-progress-box-${idx}">
                        <div class="queue-progress-header">
                            <span class="progress-status-label" id="queue-pct-label-${idx}">${item.isReady ? '✓ PDF Processing Complete' : `Uploading & Ingesting (${pct}%)`}</span>
                            <span class="progress-pct-val" id="queue-pct-val-${idx}">${pct}%</span>
                        </div>
                        <div class="queue-progress-track">
                            <div class="queue-progress-fill ${item.isReady ? 'fill-complete' : 'fill-active'}" id="queue-progress-fill-${idx}" style="width: ${pct}%;"></div>
                        </div>
                    </div>

                    <div class="queue-inputs-row">
                        <div class="queue-inp-group">
                            <label>Student Full Name</label>
                            <input type="text" class="queue-student-name-inp" data-index="${idx}" value="${item.studentName}" placeholder="e.g. Diya Sharma" />
                        </div>
                        <div class="queue-inp-group" style="max-width: 140px;">
                            <label>Roll Number</label>
                            <input type="text" class="queue-roll-inp" data-index="${idx}" value="${item.rollNo}" placeholder="e.g. 108" />
                        </div>
                    </div>

                    <!-- Page Thumbnails Row -->
                    ${item.thumbnail ? `
                        <div class="queue-thumb-strip">
                            <div class="queue-thumb-box" title="Cover Page (Page 1)">
                                <img src="${item.thumbnail}" alt="Page 1" />
                                <span>P1 of ${item.pageCount || 1}</span>
                            </div>
                            <span style="font-size: 0.78rem; color: var(--text-muted); align-self: center; margin-left: 8px;">
                                ${item.pageCount || 1} Pages Extracted &bull; Optimized Single PDF Mode
                            </span>
                        </div>
                    ` : (item.pages && item.pages.length > 0 ? `
                        <div class="queue-thumb-strip">
                            ${item.pages.slice(0, 3).map((p, pIdx) => `
                                <div class="queue-thumb-box" title="Page ${pIdx + 1}">
                                    ${typeof p === "string" && p.startsWith("data:application/pdf") ? `<iframe src="${p}" style="width:100%; height:100%; border:none; pointer-events:none;"></iframe>` : `<img src="${p}" alt="P${pIdx + 1}" />`}
                                    <span>P${pIdx + 1}</span>
                                </div>
                            `).join('')}
                            ${item.pages.length > 3 ? `<span style="font-size:0.75rem; color:var(--text-muted); align-self:center; margin-left:6px;">+${item.pages.length - 3} more</span>` : ''}
                        </div>
                    ` : '')}
                </div>
            `;
        }).join('');
    }

    // --- Event Binding ---
    bindEvents() {
        // Breadcrumb and side-step clicks
        const handleStepJump = (targetStep) => {
            if (targetStep === 1) {
                this.currentStep = 1;
                this.updateStepView();
            } else if (targetStep === 2 && this.selectedSubject) {
                this.currentStep = 2;
                this.updateStepView();
            } else if (targetStep === 3 && this.selectedTemplate) {
                this.currentStep = 3;
                this.updateStepView();
            } else if (targetStep === 4 && this.selectedClass) {
                this.currentStep = 4;
                this.updateStepView();
            }
        };

        this.container.querySelectorAll(".breadcrumb-step").forEach(stepEl => {
            stepEl.addEventListener("click", () => {
                handleStepJump(Number(stepEl.getAttribute("data-step")));
            });
        });

        this.container.querySelectorAll(".upload-side-step").forEach(stepEl => {
            stepEl.addEventListener("click", () => {
                handleStepJump(Number(stepEl.getAttribute("data-step")));
            });
        });

        // Quick subject select in upload side menu
        this.container.querySelectorAll(".upload-side-subject-btn[data-subject-id]").forEach(btn => {
            btn.addEventListener("click", () => {
                const subId = btn.getAttribute("data-subject-id");
                this.selectedSubject = this.catalog.find(s => s.id === subId) || null;
                this.selectedTemplate = null;
                this.selectedClass = null;
                this.currentStep = 2;
                this.updateStepView();
            });
        });

        // Create Subject Triggers (header button, card, and sidebar button)
        this.container.querySelectorAll(".btn-create-subject-trigger").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.openEntityModal("subject");
            });
        });

        // Quick publish from side menu
        const sidePubBtn = this.container.querySelector("#btn-side-publish-queue");
        if (sidePubBtn) {
            sidePubBtn.addEventListener("click", () => this.publishQueueToStorage());
        }

        // "Go to Teacher Evaluator Desk" button
        const gotoEvalBtn = this.container.querySelector("#btn-goto-evaluator");
        if (gotoEvalBtn) {
            gotoEvalBtn.addEventListener("click", () => {
                if (this.options.onSwitchToEvaluator) {
                    this.options.onSwitchToEvaluator();
                }
            });
        }

        // Step-specific bindings
        this.bindCurrentStepEvents();
    }

    jumpToClasses() {
        if (!this.selectedSubject) this.selectedSubject = this.catalog[0];
        if (!this.selectedTemplate) this.selectedTemplate = this.selectedSubject?.templates[0] || null;
        this.currentStep = 3;
        this.updateStepView();
    }

    jumpToPapers() {
        if (!this.selectedSubject) this.selectedSubject = this.catalog[0];
        if (!this.selectedTemplate) this.selectedTemplate = this.selectedSubject?.templates[0] || null;
        if (!this.selectedClass) this.selectedClass = this.classes[0];
        this.currentStep = 4;
        this.updateStepView();
        setTimeout(() => {
            const el = this.container.querySelector("#existing-papers-section");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
    }

    openEntityModal(type, targetItem = null) {
        let modalEl = document.getElementById("modal-portal-entity-create");
        if (!modalEl) {
            modalEl = document.createElement("div");
            modalEl.id = "modal-portal-entity-create";
            modalEl.className = "modal-backdrop";
            document.body.appendChild(modalEl);
        }

        let title = "";
        let fieldsHtml = "";
        const isEdit = !!targetItem;

        if (type === "subject") {
            title = isEdit ? "Edit Subject Details" : "Add New Subject";
            const subName = targetItem ? targetItem.name : "";
            const subCode = targetItem ? targetItem.code : "";
            const subDesc = targetItem ? targetItem.description : "";

            fieldsHtml = `
                <div class="form-group" style="margin-bottom: 14px;">
                    <label>Subject Name</label>
                    <input type="text" id="inp-create-sub-name" class="form-input" value="${subName}" placeholder="e.g. Physics" />
                </div>
                <div class="form-group" style="margin-bottom: 14px;">
                    <label>Subject Code</label>
                    <input type="text" id="inp-create-sub-code" class="form-input" value="${subCode}" placeholder="e.g. PHY-101" />
                </div>
                <div class="form-group" style="margin-bottom: 14px;">
                    <label>Description</label>
                    <input type="text" id="inp-create-sub-desc" class="form-input" value="${subDesc}" placeholder="e.g. Mechanics, Heat & Electromagnetism" />
                </div>
            `;
        } else if (type === "template") {
            this.openAdvancedTemplateModal(targetItem);
            return;
        } else if (type === "class") {
            title = "Add New Class & Section";
            fieldsHtml = `
                <div class="form-group" style="margin-bottom: 14px;">
                    <label>Class Label & Section</label>
                    <input type="text" id="inp-create-cls-label" class="form-input" placeholder="e.g. Class 11-A or Class 12-E" />
                </div>
                <div class="form-group" style="margin-bottom: 14px;">
                    <label>Academic Stream / Specialization</label>
                    <input type="text" id="inp-create-cls-stream" class="form-input" placeholder="e.g. Science & Computer Science" />
                </div>
            `;
        }

        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button type="button" class="btn-modal-close" id="btn-close-entity-modal">×</button>
                </div>
                <div class="modal-body">
                    ${fieldsHtml}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" id="btn-cancel-entity-modal">Cancel</button>
                    <button type="button" class="btn-primary" id="btn-confirm-create-entity">${isEdit ? 'Save Changes' : 'Create & Add'}</button>
                </div>
            </div>
        `;
        modalEl.classList.add("active");

        const closeModal = () => modalEl.classList.remove("active");
        modalEl.querySelector("#btn-close-entity-modal")?.addEventListener("click", closeModal);
        modalEl.querySelector("#btn-cancel-entity-modal")?.addEventListener("click", closeModal);

        modalEl.querySelector("#btn-confirm-create-entity")?.addEventListener("click", async () => {
            if (type === "subject") {
                const name = modalEl.querySelector("#inp-create-sub-name")?.value.trim();
                const code = modalEl.querySelector("#inp-create-sub-code")?.value.trim() || `SUB-${this.catalog.length + 1}01`;
                const desc = modalEl.querySelector("#inp-create-sub-desc")?.value.trim() || `${name} curriculum and answer papers`;
                if (!name) {
                    alert("Please enter a subject name.");
                    return;
                }
                if (isEdit && targetItem) {
                    targetItem.name = name;
                    targetItem.code = code;
                    targetItem.description = desc;
                    if (window.app) window.app.showToast(`Updated subject "${name}"`);
                } else {
                    const newSub = {
                        id: "sub-" + Date.now(),
                        name,
                        code,
                        badge: "1 Template",
                        description: desc,
                        templates: [
                            {
                                id: "tpl-" + Date.now(),
                                name: `${name} Standard Assessment`,
                                examName: `${name} Assessment 2026`,
                                maxMarks: 50,
                                duration: "1.5 Hours",
                                questions: [
                                    { qNumber: "Q1", maxMarks: 5, topic: "Core Fundamentals" },
                                    { qNumber: "Q2", maxMarks: 5, topic: "Conceptual Questions" },
                                    { qNumber: "Q3", maxMarks: 10, topic: "Analytical Section" },
                                    { qNumber: "Q4", maxMarks: 15, topic: "Problem Solving" },
                                    { qNumber: "Q5", maxMarks: 15, topic: "Case Study / Application" }
                                ],
                                badge: "Standard"
                            }
                        ]
                    };
                    this.catalog.push(newSub);
                    if (window.app) window.app.showToast(`Created subject "${name}"`);
                }

                if (window.appStorage) await window.appStorage.saveSubjectCatalog(this.catalog);
                closeModal();
                this.updateStepView();
            } else if (type === "class") {
                const label = modalEl.querySelector("#inp-create-cls-label")?.value.trim();
                const stream = modalEl.querySelector("#inp-create-cls-stream")?.value.trim() || "General Studies";
                if (!label) {
                    alert("Please enter a class label.");
                    return;
                }
                const cleanId = label.replace(/\s+/g, '-').replace(/Class-/i, '');
                const newCls = {
                    id: cleanId,
                    name: label.split('-')[0] || "Class",
                    section: (label.split('-')[1] || "A").trim(),
                    label,
                    studentsCount: "25 Enrolled",
                    stream
                };
                this.classes.push(newCls);
                if (window.appStorage) {
                    await window.appStorage.saveClassesList(this.classes);
                    const roster = this.generateFallbackRoster(newCls.id);
                    await window.appStorage.saveClassRoster(newCls.id, roster);
                }
                closeModal();
                this.updateStepView();
            }
        });
    }

    openCustomDeleteModal(title, message, onConfirm) {
        let modalEl = document.getElementById("modal-custom-delete-confirm");
        if (!modalEl) {
            modalEl = document.createElement("div");
            modalEl.id = "modal-custom-delete-confirm";
            modalEl.className = "modal-backdrop active";
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="modal-dialog custom-delete-modal-dialog">
                <div class="delete-icon-ring">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                </div>
                <h3 class="delete-modal-title">${title}</h3>
                <p class="delete-modal-msg">${message}</p>
                <div class="delete-modal-actions">
                    <button type="button" class="btn-secondary" id="btn-cancel-custom-delete">Cancel</button>
                    <button type="button" class="btn-danger-confirm" id="btn-confirm-custom-delete">Delete</button>
                </div>
            </div>
        `;
        modalEl.classList.add("active");

        const close = () => modalEl.classList.remove("active");
        modalEl.querySelector("#btn-cancel-custom-delete")?.addEventListener("click", close);
        modalEl.querySelector("#btn-confirm-custom-delete")?.addEventListener("click", async () => {
            close();
            if (onConfirm) await onConfirm();
        });
    }

    createCbseBiologyTemplate() {
        const sections = [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A - Multiple Choice Questions (Q1 to Q16)",
                qCount: 16,
                marksPerQ: 1,
                secTotal: 16,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B - Very Short Answer Type Questions (Q17 to Q21)",
                qCount: 5,
                marksPerQ: 2,
                secTotal: 10,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_c",
                letter: "C",
                name: "Section C",
                title: "Section C - Short Answer Type Questions (Q22 to Q28)",
                qCount: 7,
                marksPerQ: 3,
                secTotal: 21,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_d",
                letter: "D",
                name: "Section D",
                title: "Section D - Case-Based Questions with Subparts (Q29 & Q30)",
                qCount: 2,
                marksPerQ: 4,
                secTotal: 8,
                hasChoice: false,
                hasSubQuestions: true,
                subQuestions: [
                    { label: "a", marks: 1, hasChoice: false },
                    { label: "b", marks: 1, hasChoice: false },
                    { 
                        label: "c", 
                        marks: 2, 
                        hasChoice: true, 
                        choices: ["Option 1 (Ecological / Physiological Aspect)", "Option 2 (Biotechnological / Molecular Aspect)"],
                        selectedChoice: "Option 1 (Ecological / Physiological Aspect)"
                    }
                ]
            },
            {
                id: "sec_e",
                letter: "E",
                name: "Section E",
                title: "Section E - Long Answer Type Questions with Choice (Q31 to Q33)",
                qCount: 3,
                marksPerQ: 5,
                secTotal: 15,
                hasChoice: true,
                hasSubQuestions: false,
                subQuestions: []
            }
        ];

        const questions = [];
        let qNo = 1;

        // Section A: Q1 - Q16 (16 MCQs, 1M each)
        const secATopics = [
            "Reproduction in Organisms (Binary Fission & Vegetative Propagules)",
            "Microsporogenesis & Pollen Grain Morphology",
            "Spermatogenesis & Semen Composition",
            "Contraceptive Methods & Barrier Devices",
            "Mendel's Monohybrid Cross & Law of Segregation",
            "Structure of Polynucleotide Chain & Double Helix",
            "Homologous vs Analogous Organs in Evolution",
            "Infectious Agents & Plasmodium Life Cycle",
            "Microbes in Sewage Treatment & Biogas Production",
            "Restriction Endonucleases & Palindromic Sequences",
            "Transgenic Plants – Pest Resistant Bt Cotton",
            "Population Attributes: Natality, Mortality & Age Pyramids",
            "Trophic Levels & Ecological Pyramids of Energy",
            "In-situ vs Ex-situ Biodiversity Conservation",
            "Assertion & Reasoning – Molecular Genetics",
            "Assertion & Reasoning – Ecosystem Biomass"
        ];
        for (let i = 0; i < 16; i++) {
            questions.push({
                qNo: qNo,
                qNumber: `Q${qNo}`,
                label: `Q${qNo} (Section A - MCQ)`,
                section: "Section A",
                sectionId: "sec_a",
                maxMarks: 1,
                awardedMarks: 0,
                isChoice: false,
                hasSubQuestions: false,
                topic: secATopics[i] || `Section A MCQ ${qNo}`
            });
            qNo++;
        }

        // Section B: Q17 - Q21 (5 VSA, 2M each)
        const secBTopics = [
            "Oogenesis Phases & Primary Follicle Arrest",
            "Sex Determination in Birds (ZW-ZZ Mechanism)",
            "Central Dogma & Transcription Unit Structure",
            "Active vs Passive Immunity with Biological Examples",
            "Biochemical Oxygen Demand (BOD) and Water Purity"
        ];
        for (let i = 0; i < 5; i++) {
            questions.push({
                qNo: qNo,
                qNumber: `Q${qNo}`,
                label: `Q${qNo} (Section B - VSA)`,
                section: "Section B",
                sectionId: "sec_b",
                maxMarks: 2,
                awardedMarks: 0,
                isChoice: false,
                hasSubQuestions: false,
                topic: secBTopics[i] || `Section B Short Question ${qNo}`
            });
            qNo++;
        }

        // Section C: Q22 - Q28 (7 SA, 3M each)
        const secCTopics = [
            "Double Fertilization & Triple Fusion in Angiosperms",
            "Dihybrid Cross & Law of Independent Assortment",
            "Hershey-Chase Experiment Demonstrating DNA as Genetic Material",
            "Adaptations in Xerophytes and Desert Succulents",
            "Recombinant DNA Cloning Vectors (ori, selectable markers, rop)",
            "Primary vs Secondary Ecological Succession Stages",
            "Gene Therapy for Adenosine Deaminase (ADA) Deficiency"
        ];
        for (let i = 0; i < 7; i++) {
            questions.push({
                qNo: qNo,
                qNumber: `Q${qNo}`,
                label: `Q${qNo} (Section C - SA)`,
                section: "Section C",
                sectionId: "sec_c",
                maxMarks: 3,
                awardedMarks: 0,
                isChoice: false,
                hasSubQuestions: false,
                topic: secCTopics[i] || `Section C Analytical Problem ${qNo}`
            });
            qNo++;
        }

        // Section D: Q29 & Q30 (2 Case-Based, 4M each, with subparts a, b, c and OR choice in subpart c)
        questions.push({
            qNo: 29,
            qNumber: "Q29",
            label: "Q29 (Section D - Case Study I)",
            section: "Section D",
            sectionId: "sec_d",
            maxMarks: 4,
            awardedMarks: 0,
            isChoice: false,
            hasSubQuestions: true,
            topic: "Case Study on Genetically Modified Crops & Cry Proteins",
            subQuestions: [
                { subId: "a", label: "29(a)", maxMarks: 1, awardedMarks: 0 },
                { subId: "b", label: "29(b)", maxMarks: 1, awardedMarks: 0 },
                {
                    subId: "c",
                    label: "29(c)",
                    maxMarks: 2,
                    awardedMarks: 0,
                    isChoice: true,
                    choices: [
                        "Option 1: Mechanism of Bacillus thuringiensis endotoxin activation in alkaline insect gut",
                        "Option 2: RNA Interference (RNAi) silencing of specific mRNA in Meloidogyne incognita"
                    ],
                    selectedChoice: "Option 1: Mechanism of Bacillus thuringiensis endotoxin activation in alkaline insect gut"
                }
            ]
        });

        questions.push({
            qNo: 30,
            qNumber: "Q30",
            label: "Q30 (Section D - Case Study II)",
            section: "Section D",
            sectionId: "sec_d",
            maxMarks: 4,
            awardedMarks: 0,
            isChoice: false,
            hasSubQuestions: true,
            topic: "Case Study on Human Spermatogenesis and Hormonal Feedback Loops",
            subQuestions: [
                { subId: "a", label: "30(a)", maxMarks: 1, awardedMarks: 0 },
                { subId: "b", label: "30(b)", maxMarks: 1, awardedMarks: 0 },
                {
                    subId: "c",
                    label: "30(c)",
                    maxMarks: 2,
                    awardedMarks: 0,
                    isChoice: true,
                    choices: [
                        "Option 1: Roles of LH and FSH on Leydig and Sertoli cells during spermatogenesis",
                        "Option 2: Structure of human sperm and functions of Acrosome and Middle Piece mitochondria"
                    ],
                    selectedChoice: "Option 1: Roles of LH and FSH on Leydig and Sertoli cells during spermatogenesis"
                }
            ]
        });

        // Section E: Q31 - Q33 (3 Long Answer, 5M each, with internal choice)
        const secEChoices = [
            {
                topic: "Human Reproductive System & Embryonic Development",
                choices: [
                    "Option 1: Detail the menstrual cycle phases, hormonal fluctuations (estrogen, progesterone, LH surge), and ovarian changes",
                    "Option 2: Explain megasporogenesis in angiosperms, monosporic development of female gametophyte, and structure of mature embryo sac"
                ]
            },
            {
                topic: "Molecular Biology & Gene Regulation",
                choices: [
                    "Option 1: Describe DNA replication mechanism in prokaryotes including helicase, primase, DNA polymerase III, and proofreading",
                    "Option 2: Explain the regulation of Lac Operon in E. coli in the presence and absence of lactose (inducer)"
                ]
            },
            {
                topic: "Biotechnology Applications & Conservation Ecology",
                choices: [
                    "Option 1: Recombinant DNA technology steps in producing human insulin (Humulin) by Eli Lilly and processing proinsulin",
                    "Option 2: Biodiversity conservation strategies: In-situ vs Ex-situ, sacred groves, biosphere reserves, and causes of biodiversity loss ('The Evil Quartet')"
                ]
            }
        ];

        for (let i = 0; i < 3; i++) {
            const qNum = 31 + i;
            questions.push({
                qNo: qNum,
                qNumber: `Q${qNum}`,
                label: `Q${qNum} (Section E - Long Answer)`,
                section: "Section E",
                sectionId: "sec_e",
                maxMarks: 5,
                awardedMarks: 0,
                isChoice: true,
                choices: secEChoices[i].choices,
                selectedChoice: secEChoices[i].choices[0],
                hasSubQuestions: false,
                topic: secEChoices[i].topic
            });
        }

        return {
            id: "bio-cbse-12",
            name: "CBSE Class 12 Biology Board Examination",
            examName: "CBSE Class 12 Biology Board Examination",
            maxMarks: 70,
            duration: "3 Hours",
            badge: "Board Exam (33 Qs, 70 Marks)",
            sections: sections,
            questions: questions,
            instructions: [
                "This question paper contains 33 questions. All questions are compulsory.",
                "Question paper is divided into FIVE sections - Section A, B, C, D and E.",
                "Section A - questions number 1 to 16 are multiple choice type questions. Each question carries 1 mark.",
                "Section B - questions number 17 to 21 are very short answer type questions. Each question carries 2 marks.",
                "Section C - questions number 22 to 28 are short answer type questions. Each question carries 3 marks.",
                "Section D - questions number 29 and 30 are case-based questions. Each question carries 4 marks. Each question has subparts with internal choice in one of the subparts.",
                "Section E - questions number 31 to 33 are long answer type questions. Each question carries 5 marks."
            ]
        };
    }

    openAdvancedTemplateModal(targetItem = null) {
        let modalEl = document.getElementById("modal-portal-entity-create");
        if (!modalEl) {
            modalEl = document.createElement("div");
            modalEl.id = "modal-portal-entity-create";
            modalEl.className = "modal-backdrop";
            document.body.appendChild(modalEl);
        }

        const isBio = this.selectedSubject && (this.selectedSubject.id === "bio" || this.selectedSubject.name.toLowerCase().includes("bio"));

        const defaultSections = () => [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A - Multiple Choice Questions (Q1 to Q16)",
                qStartNo: 1,
                qEndNo: 16,
                qCount: 16,
                marksPerQ: 1,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B - Very Short Answer Type Questions (Q17 to Q21)",
                qStartNo: 17,
                qEndNo: 21,
                qCount: 5,
                marksPerQ: 2,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_c",
                letter: "C",
                name: "Section C",
                title: "Section C - Short Answer Type Questions (Q22 to Q28)",
                qStartNo: 22,
                qEndNo: 28,
                qCount: 7,
                marksPerQ: 3,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_d",
                letter: "D",
                name: "Section D",
                title: "Section D - Case-Based Questions with Subparts (Q29 & Q30)",
                qStartNo: 29,
                qEndNo: 30,
                qCount: 2,
                marksPerQ: 4,
                hasChoice: false,
                hasSubQuestions: true,
                subQuestionNumbers: "Q29, Q30",
                subQuestions: [
                    { label: "1", marks: 1, hasChoice: false },
                    { label: "2", marks: 1, hasChoice: false },
                    { label: "3", marks: 2, hasChoice: true, choices: ["Option 1", "Option 2"] }
                ]
            },
            {
                id: "sec_e",
                letter: "E",
                name: "Section E",
                title: "Section E - Long Answer Type Questions with Choice (Q31 to Q33)",
                qStartNo: 31,
                qEndNo: 33,
                qCount: 3,
                marksPerQ: 5,
                hasChoice: true,
                choiceQuestions: "Q31, Q32, Q33",
                hasSubQuestions: false,
                subQuestions: []
            }
        ];

        const isEdit = !!targetItem;
        const state = {
            name: targetItem ? targetItem.name : `${this.selectedSubject?.name || 'Physics'} Board Paper`,
            duration: targetItem ? (targetItem.duration || '3 Hours') : '3 Hours',
            sections: targetItem && targetItem.sections && targetItem.sections.length > 0
                ? JSON.parse(JSON.stringify(targetItem.sections))
                : defaultSections()
        };

        // Render modal layout once - strictly no full DOM destruction on keystroke
        modalEl.innerHTML = `
            <div class="modal-dialog modal-dialog-wide advanced-template-modal">
                <div class="modal-header">
                    <div>
                        <div class="modal-tag-pill">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                            Exam Blueprint & Scheme
                        </div>
                        <h3 class="modal-title">${isEdit ? 'Edit Template' : 'Create Template'} – ${this.selectedSubject?.name || 'Physics'}</h3>
                        <p class="modal-subtitle">Configure question numbers (Start–End), section marks, choice questions ("this or that"), sub-questions, or paste AI JSON.</p>
                    </div>
                    <button type="button" class="btn-modal-close" id="btn-close-adv-modal">×</button>
                </div>

                <!-- Quick Presets & AI Blueprint Tools Bar -->
                <div class="adv-tpl-preset-bar">
                    <span class="preset-label">Blueprint Presets:</span>
                    <button type="button" class="btn-preset-load" id="btn-preset-cbse-phy">
                        ⚡ Physics Board (33 Qs / 70M)
                    </button>
                    <button type="button" class="btn-preset-load" id="btn-preset-phy-mid">
                        📝 Physics Mid-Term (50M)
                    </button>
                    <button type="button" class="btn-preset-load btn-ai-prompt" id="btn-copy-ai-prompt" title="Copy prompt to pass to ChatGPT / Claude">
                        🤖 Copy AI Prompt for ChatGPT / Claude
                    </button>
                    <button type="button" class="btn-preset-load btn-ai-json" id="btn-toggle-ai-json" title="Paste JSON generated by AI">
                        📋 Paste AI JSON Template
                    </button>
                </div>

                <!-- AI JSON Import Drawer (Collapsible) -->
                <div class="ai-json-drawer-box" id="ai-json-drawer-box" style="display: none; padding: 14px 20px; background: rgba(0, 113, 227, 0.05); border-bottom: 1px solid rgba(0, 113, 227, 0.15);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 13px; font-weight: 500; color: #0071E3;">Paste AI-Generated Question Paper JSON below:</span>
                        <span style="font-size: 11px; opacity: 0.7;">Generates template structure automatically</span>
                    </div>
                    <textarea id="ai-json-input-area" class="form-input" rows="4" style="font-family: monospace; font-size: 12px;" placeholder='Paste AI JSON output here... e.g. { "name": "Physics Board Paper", "duration": "3 Hours", "sections": [...] }'></textarea>
                    <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
                        <button type="button" class="btn-secondary btn-sm" id="btn-close-ai-json-drawer">Cancel</button>
                        <button type="button" class="btn-primary btn-sm" id="btn-apply-ai-json">
                            Import & Build Blueprint
                        </button>
                    </div>
                </div>

                <div class="modal-body" style="max-height: 65vh; overflow-y: auto; padding: 20px;">
                    <!-- Top Metadata & Summary Strip -->
                    <div class="adv-tpl-top-grid">
                        <div class="form-group">
                            <label>Exam Template Name *</label>
                            <input type="text" id="adv-tpl-name" class="form-input" value="${state.name}" placeholder="e.g. Term 1 Board Assessment" />
                        </div>
                        <div class="form-group">
                            <label>Duration / Timing *</label>
                            <div class="timer-select-group">
                                <select id="adv-tpl-duration-select" class="form-input form-select-timer">
                                    <option value="45 Minutes" ${state.duration === '45 Minutes' ? 'selected' : ''}>45 Minutes</option>
                                    <option value="1 Hour" ${state.duration === '1 Hour' ? 'selected' : ''}>1 Hour (60 Mins)</option>
                                    <option value="1.5 Hours" ${state.duration === '1.5 Hours' ? 'selected' : ''}>1.5 Hours (90 Mins)</option>
                                    <option value="2 Hours" ${state.duration === '2 Hours' ? 'selected' : ''}>2 Hours (120 Mins)</option>
                                    <option value="2.5 Hours" ${state.duration === '2.5 Hours' ? 'selected' : ''}>2.5 Hours (150 Mins)</option>
                                    <option value="3 Hours" ${state.duration === '3 Hours' || !state.duration ? 'selected' : ''}>3 Hours (CBSE Standard - 180 Mins)</option>
                                    <option value="3.5 Hours" ${state.duration === '3.5 Hours' ? 'selected' : ''}>3.5 Hours (210 Mins)</option>
                                    <option value="Custom" ${!['45 Minutes','1 Hour','1.5 Hours','2 Hours','2.5 Hours','3 Hours','3.5 Hours'].includes(state.duration) ? 'selected' : ''}>Custom Timing...</option>
                                </select>
                                <input type="text" id="adv-tpl-duration-custom" class="form-input" style="display: ${!['45 Minutes','1 Hour','1.5 Hours','2 Hours','2.5 Hours','3 Hours','3.5 Hours'].includes(state.duration) ? 'block' : 'none'}; margin-top: 6px;" placeholder="e.g. 150 Minutes" value="${state.duration || '3 Hours'}" />
                            </div>
                        </div>
                        <div class="adv-tpl-summary-pill-box">
                            <div class="summary-metric">
                                <span class="met-label">Total Marks</span>
                                <span class="met-val" id="adv-summary-total-marks">0 M</span>
                            </div>
                            <div class="summary-metric">
                                <span class="met-label">Total Questions</span>
                                <span class="met-val" id="adv-summary-total-q">0 Qs</span>
                            </div>
                            <div class="summary-metric">
                                <span class="met-label">Sections</span>
                                <span class="met-val" id="adv-summary-total-sec">0</span>
                            </div>
                        </div>
                    </div>

                    <!-- Sections Configurator Container -->
                    <div class="adv-sections-container">
                        <div class="adv-sec-header-row">
                            <span class="adv-sec-heading" id="adv-sections-heading">Exam Sections</span>
                            <span class="adv-sec-subtext">Set Question Starts No – Questions End No, Marks per question, Choice, and Sub-Parts (1,2,3,4,5 / a,b,c)</span>
                        </div>

                        <div class="adv-sections-list" id="adv-sections-list">
                            <!-- Section cards rendered here -->
                        </div>

                        <button type="button" class="btn-adv-add-section" id="btn-adv-add-sec">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            <span id="btn-adv-add-sec-label">Add Next Section</span>
                        </button>
                    </div>
                </div>

                <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="modal-footer-note">Template blueprint will be available across all classes for this subject.</span>
                    <div class="modal-footer-actions">
                        <button type="button" class="btn-secondary" id="btn-cancel-adv-modal">Cancel</button>
                        <button type="button" class="btn-primary" id="btn-save-adv-template">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                            Create Exam Template
                        </button>
                    </div>
                </div>
            </div>
        `;

        const closeModal = () => modalEl.classList.remove("active");
        modalEl.querySelector("#btn-close-adv-modal")?.addEventListener("click", closeModal);
        modalEl.querySelector("#btn-cancel-adv-modal")?.addEventListener("click", closeModal);

        // Copy AI Prompt handler
        modalEl.querySelector("#btn-copy-ai-prompt")?.addEventListener("click", () => {
            const promptText = `Please generate an exam blueprint template JSON for an automated digital paper evaluation system.

REQUIRED JSON SCHEMA (Respond ONLY with valid raw JSON, without markdown wrapper):
{
  "name": "Subject Exam Title (e.g. Physics Annual Board Paper 2026)",
  "duration": "3 Hours",
  "sections": [
    {
      "letter": "A",
      "title": "Section A - Multiple Choice Questions",
      "qStartNo": 1,
      "qEndNo": 16,
      "marksPerQ": 1,
      "hasChoice": false,
      "hasSubQuestions": false,
      "subQuestions": []
    },
    {
      "letter": "B",
      "title": "Section B - Very Short Answer Questions",
      "qStartNo": 17,
      "qEndNo": 21,
      "marksPerQ": 2,
      "hasChoice": true,
      "choiceQuestions": "Q20, Q21",
      "hasSubQuestions": false,
      "subQuestions": []
    },
    {
      "letter": "C",
      "title": "Section C - Long Answer Questions with Subparts",
      "qStartNo": 22,
      "qEndNo": 25,
      "marksPerQ": 5,
      "hasChoice": true,
      "choiceQuestions": "Q24, Q25",
      "hasSubQuestions": true,
      "subQuestionNumbers": "Q22, Q23",
      "subQuestions": [
        { "label": "1", "marks": 2, "hasChoice": false },
        { "label": "2", "marks": 2, "hasChoice": false },
        { "label": "3", "marks": 1, "hasChoice": true }
      ]
    }
  ]
}

MY QUESTION PAPER SPECIFICATION:
Subject: ${this.selectedSubject?.name || 'Science'}
Max Marks: 70
Exam Paper Structure / Questions Details: [Paste your paper details or question counts here]`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(promptText).then(() => {
                    if (window.app) window.app.showToast("Copied AI Prompt to Clipboard! Paste in ChatGPT/Claude.");
                });
            } else {
                alert("AI Prompt copied to clipboard!");
            }
        });

        // AI JSON Drawer toggle
        const aiDrawer = modalEl.querySelector("#ai-json-drawer-box");
        modalEl.querySelector("#btn-toggle-ai-json")?.addEventListener("click", () => {
            if (aiDrawer) {
                aiDrawer.style.display = aiDrawer.style.display === "none" ? "block" : "none";
                if (aiDrawer.style.display === "block") {
                    modalEl.querySelector("#ai-json-input-area")?.focus();
                }
            }
        });

        modalEl.querySelector("#btn-close-ai-json-drawer")?.addEventListener("click", () => {
            if (aiDrawer) aiDrawer.style.display = "none";
        });

        // Apply AI JSON handler
        modalEl.querySelector("#btn-apply-ai-json")?.addEventListener("click", () => {
            const rawJson = modalEl.querySelector("#ai-json-input-area")?.value.trim();
            if (!rawJson) {
                if (window.app) window.app.showToast("Please paste AI JSON first.", "warning");
                return;
            }

            try {
                const cleaned = rawJson.replace(/```json/g, "").replace(/```/g, "").trim();
                const parsed = JSON.parse(cleaned);

                if (!parsed || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
                    throw new Error("JSON must include a 'sections' array with at least 1 section.");
                }

                state.name = parsed.name || state.name;
                state.duration = parsed.duration || state.duration;
                state.sections = parsed.sections.map((sec, idx) => {
                    const letter = sec.letter || String.fromCharCode(65 + idx);
                    const qStartNo = Math.max(1, Number(sec.qStartNo) || 1);
                    const qEndNo = Math.max(qStartNo, Number(sec.qEndNo) || (qStartNo + (Number(sec.qCount) || 5) - 1));
                    const qCount = Math.max(1, qEndNo - qStartNo + 1);
                    return {
                        id: `sec_${letter.toLowerCase()}`,
                        letter: letter,
                        name: `Section ${letter}`,
                        title: sec.title || `Section ${letter}`,
                        qStartNo: qStartNo,
                        qEndNo: qEndNo,
                        qCount: qCount,
                        marksPerQ: Math.max(0.5, Number(sec.marksPerQ) || 1),
                        hasChoice: !!sec.hasChoice,
                        choiceQuestions: sec.choiceQuestions || "",
                        hasSubQuestions: !!sec.hasSubQuestions,
                        subQuestionNumbers: sec.subQuestionNumbers || "",
                        subQuestions: Array.isArray(sec.subQuestions) ? sec.subQuestions.map((sq, sqIdx) => ({
                            label: sq.label || String(sqIdx + 1),
                            marks: Math.max(0.5, Number(sq.marks) || 1),
                            hasChoice: !!sq.hasChoice
                        })) : []
                    };
                });

                const nameInp = modalEl.querySelector("#adv-tpl-name");
                if (nameInp) nameInp.value = state.name;
                const durSelect = modalEl.querySelector("#adv-tpl-duration-select");
                if (durSelect) durSelect.value = state.duration;

                if (aiDrawer) aiDrawer.style.display = "none";
                renderAllSections();
                updateCalculations();

                if (window.app) window.app.showToast(`Imported AI Blueprint with ${state.sections.length} sections!`);
            } catch (err) {
                console.error("AI JSON Parse error:", err);
                if (window.app) window.app.showToast(`Invalid AI JSON: ${err.message}`, "error");
            }
        });

        // In-place calculations updater - NEVER destroys DOM, preserves focus and scroll
        const updateCalculations = () => {
            let totalMarks = 0;
            let totalQuestions = 0;

            state.sections.forEach((sec, sIdx) => {
                const qStartNo = Math.max(1, Number(sec.qStartNo) || 1);
                const qEndNo = Math.max(qStartNo, Number(sec.qEndNo) || qStartNo);
                const qCount = Math.max(1, qEndNo - qStartNo + 1);
                sec.qStartNo = qStartNo;
                sec.qEndNo = qEndNo;
                sec.qCount = qCount;

                const marksPerQ = Math.max(0.5, Number(sec.marksPerQ) || 0.5);
                const secTotal = Math.round(qCount * marksPerQ * 10) / 10;
                sec.secTotal = secTotal;
                totalQuestions += qCount;
                totalMarks += secTotal;

                const card = modalEl.querySelector(`.adv-section-card[data-sec-idx="${sIdx}"]`);
                if (card) {
                    const badge = card.querySelector(".sec-marks-badge");
                    if (badge) badge.textContent = `${secTotal} Marks Total`;
                    const display = card.querySelector(".sec-total-display");
                    if (display) display.value = `${secTotal} Marks`;

                    const subqTarget = card.querySelector(".subq-target-val");
                    if (subqTarget) subqTarget.textContent = `${marksPerQ} Marks`;

                    // Sub-questions sum status badge
                    const subqSumBadge = card.querySelector(".subq-sum-badge");
                    if (subqSumBadge && sec.hasSubQuestions) {
                        const subSum = (sec.subQuestions || []).reduce((sum, sq) => sum + (Number(sq.marks) || 0), 0);
                        const roundedSubSum = Math.round(subSum * 10) / 10;
                        const diff = Math.round((marksPerQ - roundedSubSum) * 10) / 10;

                        if (Math.abs(diff) < 0.01) {
                            subqSumBadge.className = "subq-sum-badge status-match";
                            subqSumBadge.textContent = `Parts sum: ${roundedSubSum}/${marksPerQ}M ✓`;
                        } else if (diff > 0) {
                            subqSumBadge.className = "subq-sum-badge status-under";
                            subqSumBadge.textContent = `Parts sum: ${roundedSubSum}/${marksPerQ}M (Need +${diff}M)`;
                        } else {
                            subqSumBadge.className = "subq-sum-badge status-over";
                            subqSumBadge.textContent = `Parts sum: ${roundedSubSum}/${marksPerQ}M (Exceeds by +${-diff}M)`;
                        }
                    }
                }
            });

            totalMarks = Math.round(totalMarks * 10) / 10;
            const totalMarksEl = modalEl.querySelector("#adv-summary-total-marks");
            if (totalMarksEl) totalMarksEl.textContent = `${totalMarks} M`;
            const totalQEl = modalEl.querySelector("#adv-summary-total-q");
            if (totalQEl) totalQEl.textContent = `${totalQuestions} Qs`;
            const totalSecEl = modalEl.querySelector("#adv-summary-total-sec");
            if (totalSecEl) totalSecEl.textContent = `${state.sections.length}`;
            const headingEl = modalEl.querySelector("#adv-sections-heading");
            if (headingEl) headingEl.textContent = `Exam Sections (${state.sections.length})`;
        };

        // Render sub-question chips for a section card in-place
        const renderSubQuestionsForSection = (secIdx) => {
            const sec = state.sections[secIdx];
            const container = modalEl.querySelector(`#subq-chips-row-${secIdx}`);
            if (!sec || !container) return;

            if (!sec.subQuestions) sec.subQuestions = [];

            container.innerHTML = sec.subQuestions.map((sub, subIdx) => `
                <div class="subq-chip-pill" data-sec-idx="${secIdx}" data-sub-idx="${subIdx}">
                    <span class="subq-prefix">Part:</span>
                    <input type="text" class="subq-label-input" data-sec-idx="${secIdx}" data-sub-idx="${subIdx}" value="${sub.label || String(subIdx + 1)}" placeholder="label" title="Subpart label (e.g. 1, 2, 3 or a, b, c)" />
                    <input type="number" step="0.5" class="subq-mark-input" data-sec-idx="${secIdx}" data-sub-idx="${subIdx}" value="${sub.marks !== undefined ? sub.marks : 1}" min="0.5" title="Marks for this subpart" />
                    <span class="subq-unit">M</span>
                    <label class="subq-choice-chk-label" title="Internal choice for this subpart ('this or that')">
                        <input type="checkbox" class="subq-choice-chk" data-sec-idx="${secIdx}" data-sub-idx="${subIdx}" ${sub.hasChoice ? 'checked' : ''} />
                        <span>OR</span>
                    </label>
                    <button type="button" class="btn-delete-subq" data-sec-idx="${secIdx}" data-sub-idx="${subIdx}" title="Remove subpart">×</button>
                </div>
            `).join("");

            bindSubQuestionEventsForSection(secIdx);
        };

        // Event bindings for sub-questions
        const bindSubQuestionEventsForSection = (secIdx) => {
            const container = modalEl.querySelector(`#subq-chips-row-${secIdx}`);
            if (!container) return;

            container.querySelectorAll(".subq-label-input").forEach(inp => {
                inp.addEventListener("input", (e) => {
                    const subIdx = Number(inp.getAttribute("data-sub-idx"));
                    if (state.sections[secIdx]?.subQuestions?.[subIdx]) {
                        state.sections[secIdx].subQuestions[subIdx].label = e.target.value.trim();
                    }
                });
            });

            container.querySelectorAll(".subq-mark-input").forEach(inp => {
                inp.addEventListener("input", (e) => {
                    const subIdx = Number(inp.getAttribute("data-sub-idx"));
                    if (state.sections[secIdx]?.subQuestions?.[subIdx]) {
                        state.sections[secIdx].subQuestions[subIdx].marks = Math.max(0.5, Number(e.target.value) || 0.5);
                        updateCalculations(); // In-place, preserves focus!
                    }
                });
            });

            container.querySelectorAll(".subq-choice-chk").forEach(chk => {
                chk.addEventListener("change", (e) => {
                    const subIdx = Number(chk.getAttribute("data-sub-idx"));
                    if (state.sections[secIdx]?.subQuestions?.[subIdx]) {
                        state.sections[secIdx].subQuestions[subIdx].hasChoice = e.target.checked;
                    }
                });
            });

            container.querySelectorAll(".btn-delete-subq").forEach(btn => {
                btn.addEventListener("click", () => {
                    const subIdx = Number(btn.getAttribute("data-sub-idx"));
                    if (state.sections[secIdx]?.subQuestions) {
                        state.sections[secIdx].subQuestions.splice(subIdx, 1);
                        renderSubQuestionsForSection(secIdx);
                        updateCalculations();
                    }
                });
            });
        };

        // Event bindings for section card
        const bindSectionCardEvents = (card, secIdx) => {
            card.querySelector(".sec-name-input")?.addEventListener("input", (e) => {
                if (state.sections[secIdx]) state.sections[secIdx].title = e.target.value;
            });

            card.querySelector(".sec-qstart-input")?.addEventListener("input", (e) => {
                if (state.sections[secIdx]) {
                    const startVal = Math.max(1, Number(e.target.value) || 1);
                    state.sections[secIdx].qStartNo = startVal;
                    if (!state.sections[secIdx].qEndNo || state.sections[secIdx].qEndNo < startVal) {
                        state.sections[secIdx].qEndNo = startVal + (state.sections[secIdx].qCount || 1) - 1;
                    }
                    state.sections[secIdx].qCount = Math.max(1, state.sections[secIdx].qEndNo - startVal + 1);
                    const endInp = card.querySelector(".sec-qend-input");
                    if (endInp) endInp.value = state.sections[secIdx].qEndNo;
                    const countInp = card.querySelector(".sec-qcount-input");
                    if (countInp) countInp.value = state.sections[secIdx].qCount;
                    updateCalculations();
                }
            });

            card.querySelector(".sec-qend-input")?.addEventListener("input", (e) => {
                if (state.sections[secIdx]) {
                    const startVal = Math.max(1, Number(state.sections[secIdx].qStartNo) || 1);
                    const endVal = Math.max(startVal, Number(e.target.value) || startVal);
                    state.sections[secIdx].qEndNo = endVal;
                    state.sections[secIdx].qCount = Math.max(1, endVal - startVal + 1);
                    const countInp = card.querySelector(".sec-qcount-input");
                    if (countInp) countInp.value = state.sections[secIdx].qCount;
                    updateCalculations();
                }
            });

            card.querySelector(".sec-qcount-input")?.addEventListener("input", (e) => {
                if (state.sections[secIdx]) {
                    const count = Math.max(1, Number(e.target.value) || 1);
                    state.sections[secIdx].qCount = count;
                    const startVal = Math.max(1, Number(state.sections[secIdx].qStartNo) || 1);
                    state.sections[secIdx].qEndNo = startVal + count - 1;
                    const endInp = card.querySelector(".sec-qend-input");
                    if (endInp) endInp.value = state.sections[secIdx].qEndNo;
                    updateCalculations();
                }
            });

            card.querySelector(".sec-marksq-input")?.addEventListener("input", (e) => {
                if (state.sections[secIdx]) {
                    state.sections[secIdx].marksPerQ = Math.max(0.5, Number(e.target.value) || 0.5);
                    updateCalculations();
                }
            });

            // Quick pattern generator buttons (Parts 1, 2, 3, 4, 5 / a, b, c)
            card.querySelectorAll(".btn-subq-pattern").forEach(btn => {
                btn.addEventListener("click", () => {
                    const pattern = btn.getAttribute("data-pattern");
                    if (!state.sections[secIdx]) return;
                    const totalM = state.sections[secIdx].marksPerQ || 5;

                    let labels = [];
                    if (pattern === "1,2,3,4,5") labels = ["1", "2", "3", "4", "5"];
                    else if (pattern === "a,b,c") labels = ["a", "b", "c"];
                    else if (pattern === "a,b") labels = ["a", "b"];
                    else if (pattern === "1,2,3") labels = ["1", "2", "3"];

                    const eachM = Math.max(0.5, Math.round((totalM / labels.length) * 10) / 10);
                    state.sections[secIdx].subQuestions = labels.map(lbl => ({
                        label: lbl,
                        marks: eachM,
                        hasChoice: false
                    }));

                    renderSubQuestionsForSection(secIdx);
                    updateCalculations();
                });
            });

            card.querySelector(".chk-sec-choice")?.addEventListener("change", (e) => {
                if (state.sections[secIdx]) {
                    state.sections[secIdx].hasChoice = e.target.checked;
                    const hintBox = card.querySelector(`#sec-choice-box-${secIdx}`);
                    if (hintBox) {
                        hintBox.style.display = e.target.checked ? 'flex' : 'none';
                        if (e.target.checked) {
                            const inp = hintBox.querySelector(".sec-choice-qnos-input");
                            if (inp) inp.focus();
                        }
                    }
                }
            });

            card.querySelector(".sec-choice-qnos-input")?.addEventListener("input", (e) => {
                if (state.sections[secIdx]) {
                    state.sections[secIdx].choiceQuestions = e.target.value;
                }
            });

            card.querySelector(".btn-clear-choice")?.addEventListener("click", () => {
                if (state.sections[secIdx]) {
                    state.sections[secIdx].hasChoice = false;
                    state.sections[secIdx].choiceQuestions = "";
                    const chk = card.querySelector(".chk-sec-choice");
                    if (chk) chk.checked = false;
                    const hintBox = card.querySelector(`#sec-choice-box-${secIdx}`);
                    if (hintBox) hintBox.style.display = 'none';
                    const inp = card.querySelector(".sec-choice-qnos-input");
                    if (inp) inp.value = "";
                }
            });

            card.querySelector(".chk-sec-subq")?.addEventListener("change", (e) => {
                if (state.sections[secIdx]) {
                    state.sections[secIdx].hasSubQuestions = e.target.checked;
                    const builder = card.querySelector(`#sec-subq-builder-${secIdx}`);
                    if (e.target.checked) {
                        if (!state.sections[secIdx].subQuestions || state.sections[secIdx].subQuestions.length === 0) {
                            const half = Math.max(0.5, Math.floor(state.sections[secIdx].marksPerQ / 2));
                            state.sections[secIdx].subQuestions = [
                                { label: "1", marks: half, hasChoice: false },
                                { label: "2", marks: Math.max(0.5, state.sections[secIdx].marksPerQ - half), hasChoice: false }
                            ];
                        }
                        if (builder) {
                            builder.style.display = "block";
                            const inp = builder.querySelector(".sec-subq-qnos-input");
                            if (inp) inp.focus();
                        }
                        renderSubQuestionsForSection(secIdx);
                    } else {
                        if (builder) builder.style.display = "none";
                    }
                    updateCalculations();
                }
            });

            card.querySelector(".sec-subq-qnos-input")?.addEventListener("input", (e) => {
                if (state.sections[secIdx]) {
                    state.sections[secIdx].subQuestionNumbers = e.target.value;
                }
            });

            card.querySelector(".btn-clear-subq-config")?.addEventListener("click", () => {
                if (state.sections[secIdx]) {
                    state.sections[secIdx].hasSubQuestions = false;
                    state.sections[secIdx].subQuestions = [];
                    state.sections[secIdx].subQuestionNumbers = "";
                    const chk = card.querySelector(".chk-sec-subq");
                    if (chk) chk.checked = false;
                    const builder = card.querySelector(`#sec-subq-builder-${secIdx}`);
                    if (builder) builder.style.display = 'none';
                    const inp = card.querySelector(".sec-subq-qnos-input");
                    if (inp) inp.value = "";
                    updateCalculations();
                }
            });

            card.querySelector(".btn-add-subq-part")?.addEventListener("click", () => {
                if (state.sections[secIdx]) {
                    if (!state.sections[secIdx].subQuestions) state.sections[secIdx].subQuestions = [];
                    const nextLabel = String(state.sections[secIdx].subQuestions.length + 1);
                    state.sections[secIdx].subQuestions.push({ label: nextLabel, marks: 1, hasChoice: false });
                    renderSubQuestionsForSection(secIdx);
                    updateCalculations();
                }
            });

            card.querySelector(".btn-delete-sec")?.addEventListener("click", () => {
                if (state.sections.length > 1) {
                    state.sections.splice(secIdx, 1);
                    state.sections.forEach((s, i) => {
                        s.letter = String.fromCharCode(65 + i);
                        s.name = `Section ${s.letter}`;
                    });
                    renderAllSections();
                    updateCalculations();
                } else {
                    if (window.app) window.app.showToast("At least one exam section is required.", "warning");
                }
            });
        };

        // Render all section cards in container
        const renderAllSections = () => {
            const listEl = modalEl.querySelector("#adv-sections-list");
            if (!listEl) return;

            listEl.innerHTML = state.sections.map((sec, secIdx) => {
                const qStartNo = Math.max(1, Number(sec.qStartNo) || 1);
                const qEndNo = Math.max(qStartNo, Number(sec.qEndNo) || (qStartNo + (Number(sec.qCount) || 1) - 1));
                const qCount = Math.max(1, qEndNo - qStartNo + 1);
                sec.qStartNo = qStartNo;
                sec.qEndNo = qEndNo;
                sec.qCount = qCount;

                const secMarks = qCount * (Number(sec.marksPerQ) || 0);
                sec.secTotal = Math.round(secMarks * 10) / 10;

                return `
                    <div class="adv-section-card" data-sec-idx="${secIdx}" id="adv-section-card-${secIdx}">
                        <div class="sec-card-header">
                            <div class="sec-title-wrap">
                                <span class="sec-letter-badge">Section ${sec.letter}</span>
                                <input type="text" class="form-input-inline sec-name-input" data-sec-idx="${secIdx}" value="${sec.title}" placeholder="Section Title..." />
                            </div>
                            <div class="sec-header-actions">
                                <span class="sec-marks-badge" id="sec-marks-badge-${secIdx}">
                                    ${sec.secTotal} Marks Total
                                </span>
                                ${state.sections.length > 1 ? `
                                    <button type="button" class="btn-delete-sec" data-sec-idx="${secIdx}" title="Remove Section">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    </button>
                                ` : ''}
                            </div>
                        </div>

                        <div class="sec-card-body">
                            <div class="sec-inputs-row">
                                <div class="sec-field">
                                    <label>Question Starts No</label>
                                    <input type="number" min="1" max="200" class="form-input sec-qstart-input" data-sec-idx="${secIdx}" value="${sec.qStartNo}" title="Start question number (e.g. 1, 17, 22)" />
                                </div>
                                <div class="sec-field">
                                    <label>Question Ends No</label>
                                    <input type="number" min="1" max="200" class="form-input sec-qend-input" data-sec-idx="${secIdx}" value="${sec.qEndNo}" title="End question number (e.g. 16, 21, 28)" />
                                </div>
                                <div class="sec-field">
                                    <label>No. of Questions</label>
                                    <input type="number" min="1" max="100" class="form-input sec-qcount-input" data-sec-idx="${secIdx}" value="${sec.qCount}" title="Total questions in section" />
                                </div>
                                <div class="sec-field">
                                    <label>Marks Per Question</label>
                                    <input type="number" step="0.5" min="0.5" max="50" class="form-input sec-marksq-input" data-sec-idx="${secIdx}" value="${sec.marksPerQ}" />
                                </div>
                                <div class="sec-field">
                                    <label>Section Total Marks</label>
                                    <input type="text" class="form-input sec-total-display" id="sec-total-display-${secIdx}" readonly value="${sec.secTotal} Marks" />
                                </div>
                            </div>

                            <!-- Advanced Options: Choice & Sub-Questions -->
                            <div class="sec-special-options">
                                <label class="checkbox-option-item">
                                    <input type="checkbox" class="chk-sec-choice" data-sec-idx="${secIdx}" ${sec.hasChoice ? 'checked' : ''} />
                                    <span class="chk-label">Include Choice / "OR" Questions ("this or that")</span>
                                </label>
                                <label class="checkbox-option-item">
                                    <input type="checkbox" class="chk-sec-subq" data-sec-idx="${secIdx}" ${sec.hasSubQuestions ? 'checked' : ''} />
                                    <span class="chk-label">Include Questions with Sub-Parts (e.g. 1, 2, 3, 4, 5 / a, b, c)</span>
                                </label>
                            </div>

                            <div class="sec-choice-hint-box" id="sec-choice-box-${secIdx}" style="display: ${sec.hasChoice ? 'flex' : 'none'};">
                                <div class="sec-choice-top">
                                    <div class="sec-choice-info">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0071E3" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                        <span>Choice Questions ("this or that"): Question total remains ${sec.marksPerQ} Marks.</span>
                                    </div>
                                    <button type="button" class="btn-clear-choice" data-sec-idx="${secIdx}" title="Remove Choice config">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        Delete Choice
                                    </button>
                                </div>
                                <div class="sec-choice-qno-row">
                                    <label class="qno-prompt-label">Which Question No(s) have choice?</label>
                                    <input type="text" class="form-input sec-choice-qnos-input" data-sec-idx="${secIdx}" placeholder="e.g. Q31, Q32, Q33 (or leave blank for all)" value="${sec.choiceQuestions || ''}" />
                                </div>
                            </div>

                            <div class="sec-subq-builder-box" id="sec-subq-builder-${secIdx}" style="display: ${sec.hasSubQuestions ? 'block' : 'none'};">
                                <div class="subq-header-row">
                                    <div class="subq-title-wrap">
                                        <span class="subq-builder-title">Sub-Question Parts Breakdown (Target: <span class="subq-target-val">${sec.marksPerQ} Marks</span>):</span>
                                        <span class="subq-sum-badge" id="subq-sum-badge-${secIdx}">Parts sum: 0M</span>
                                    </div>
                                    <div class="subq-header-actions">
                                        <button type="button" class="btn-add-subq-part" data-sec-idx="${secIdx}">+ Add Part</button>
                                        <button type="button" class="btn-clear-subq-config" data-sec-idx="${secIdx}" title="Remove Sub-Parts config">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                            Delete Sub-Parts
                                        </button>
                                    </div>
                                </div>
                                <div class="subq-quick-patterns-bar" style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; background: rgba(0,0,0,0.02); padding: 6px 10px; border-radius: 6px;">
                                    <span style="font-size: 11px; color: #6e6e73; font-weight: 500;">Quick Pattern:</span>
                                    <button type="button" class="btn-subq-pattern btn-xs" data-sec-idx="${secIdx}" data-pattern="1,2,3,4,5">Parts 1, 2, 3, 4, 5</button>
                                    <button type="button" class="btn-subq-pattern btn-xs" data-sec-idx="${secIdx}" data-pattern="a,b,c">Parts a, b, c</button>
                                    <button type="button" class="btn-subq-pattern btn-xs" data-sec-idx="${secIdx}" data-pattern="a,b">Parts a, b</button>
                                    <button type="button" class="btn-subq-pattern btn-xs" data-sec-idx="${secIdx}" data-pattern="1,2,3">Parts 1, 2, 3</button>
                                </div>
                                <div class="sec-subq-qno-row">
                                    <label class="qno-prompt-label">Which Question No(s) have sub-parts?</label>
                                    <input type="text" class="form-input sec-subq-qnos-input" data-sec-idx="${secIdx}" placeholder="e.g. Q29, Q30 (or leave blank for all)" value="${sec.subQuestionNumbers || ''}" />
                                </div>
                                <div class="subq-chips-row" id="subq-chips-row-${secIdx}">
                                    <!-- Rendered dynamically -->
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");

            state.sections.forEach((sec, idx) => {
                const card = listEl.querySelector(`.adv-section-card[data-sec-idx="${idx}"]`);
                if (card) {
                    bindSectionCardEvents(card, idx);
                    if (sec.hasSubQuestions) {
                        renderSubQuestionsForSection(idx);
                    }
                }
            });

            const addSecLabel = modalEl.querySelector("#btn-adv-add-sec-label");
            if (addSecLabel) {
                addSecLabel.textContent = `Add Next Section (Section ${String.fromCharCode(65 + state.sections.length)})`;
            }
        };

        // Top input event listeners
        modalEl.querySelector("#adv-tpl-name")?.addEventListener("input", (e) => {
            state.name = e.target.value;
        });

        modalEl.querySelector("#adv-tpl-duration-select")?.addEventListener("change", (e) => {
            const customInp = modalEl.querySelector("#adv-tpl-duration-custom");
            if (e.target.value === "Custom") {
                if (customInp) {
                    customInp.style.display = "block";
                    customInp.focus();
                    state.duration = customInp.value || "3 Hours";
                }
            } else {
                if (customInp) customInp.style.display = "none";
                state.duration = e.target.value;
            }
        });

        modalEl.querySelector("#adv-tpl-duration-custom")?.addEventListener("input", (e) => {
            state.duration = e.target.value;
        });

        // Preset 0: Physics Board Blueprint (33 Qs, 70 Marks)
        modalEl.querySelector("#btn-preset-cbse-phy")?.addEventListener("click", () => {
            state.name = "Physics Board Paper (33 Qs / 70 Marks)";
            state.duration = "3 Hours";
            state.sections = defaultSections();

            const nameInp = modalEl.querySelector("#adv-tpl-name");
            if (nameInp) nameInp.value = state.name;
            const durSelect = modalEl.querySelector("#adv-tpl-duration-select");
            if (durSelect) durSelect.value = "3 Hours";
            const durCustom = modalEl.querySelector("#adv-tpl-duration-custom");
            if (durCustom) durCustom.style.display = "none";

            renderAllSections();
            updateCalculations();
            if (window.app) window.app.showToast("Loaded Physics Board Blueprint (33 Qs / 70 Marks)!");
        });

        // Preset 1: Physics Mid-Term Blueprint (50 Marks)
        modalEl.querySelector("#btn-preset-phy-mid")?.addEventListener("click", () => {
            state.name = "Physics Mid-Term Exam (50 Marks)";
            state.duration = "2 Hours";
            state.sections = [
                { id: "sec_a", letter: "A", name: "Section A", title: "Section A - Very Short Answer Questions (Q1 to Q5)", qStartNo: 1, qEndNo: 5, qCount: 5, marksPerQ: 2, hasChoice: false, hasSubQuestions: false, subQuestions: [] },
                { id: "sec_b", letter: "B", name: "Section B", title: "Section B - Short Answer Questions (Q6 to Q10)", qStartNo: 6, qEndNo: 10, qCount: 5, marksPerQ: 3, hasChoice: false, hasSubQuestions: false, subQuestions: [] },
                { id: "sec_c", letter: "C", name: "Section C", title: "Section C - Long Answer Questions (Q11 to Q15)", qStartNo: 11, qEndNo: 15, qCount: 5, marksPerQ: 5, hasChoice: true, choiceQuestions: "Q14, Q15", hasSubQuestions: false, subQuestions: [] }
            ];

            const nameInp = modalEl.querySelector("#adv-tpl-name");
            if (nameInp) nameInp.value = state.name;
            const durSelect = modalEl.querySelector("#adv-tpl-duration-select");
            if (durSelect) durSelect.value = "2 Hours";
            const durCustom = modalEl.querySelector("#adv-tpl-duration-custom");
            if (durCustom) durCustom.style.display = "none";

            renderAllSections();
            updateCalculations();
            if (window.app) window.app.showToast("Loaded Physics Mid-Term Blueprint (50 Marks)!");
        });

        // Add Section button
        modalEl.querySelector("#btn-adv-add-sec")?.addEventListener("click", () => {
            const nextLetter = String.fromCharCode(65 + state.sections.length);
            const lastSec = state.sections[state.sections.length - 1];
            const nextStart = lastSec ? (lastSec.qEndNo + 1) : 1;
            const nextEnd = nextStart + 4;

            state.sections.push({
                id: `sec_${nextLetter.toLowerCase()}`,
                letter: nextLetter,
                name: `Section ${nextLetter}`,
                title: `Section ${nextLetter} - Additional Assessment (Q${nextStart} to Q${nextEnd})`,
                qStartNo: nextStart,
                qEndNo: nextEnd,
                qCount: 5,
                marksPerQ: 4,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            });
            renderAllSections();
            updateCalculations();
        });

        // Save Template
        modalEl.querySelector("#btn-save-adv-template")?.addEventListener("click", async () => {
            const tplName = modalEl.querySelector("#adv-tpl-name")?.value.trim() || state.name;
            const durSelect = modalEl.querySelector("#adv-tpl-duration-select");
            const durCustom = modalEl.querySelector("#adv-tpl-duration-custom");
            const duration = (durSelect && durSelect.value === 'Custom')
                ? (durCustom?.value.trim() || '3 Hours')
                : (durSelect?.value || state.duration || '3 Hours');

            const matchesQuestionSpec = (spec, qNo) => {
                if (!spec || !spec.trim()) return true; // Default: applies to all questions in section
                const raw = spec.toLowerCase().replace(/q/g, '').trim();
                if (raw === 'all') return true;
                const tokens = raw.split(/[,;\s]+/).filter(Boolean);
                return tokens.some(t => {
                    if (t.includes('-')) {
                        const [start, end] = t.split('-').map(Number);
                        return !isNaN(start) && !isNaN(end) && qNo >= start && qNo <= end;
                    }
                    return Number(t) === qNo;
                });
            };

            let totalMaxMarks = 0;
            let questionList = [];

            const structuredSections = state.sections.map((sec) => {
                const startNo = Math.max(1, Number(sec.qStartNo) || 1);
                const endNo = Math.max(startNo, Number(sec.qEndNo) || (startNo + Math.max(1, Number(sec.qCount) || 1) - 1));
                const count = Math.max(1, endNo - startNo + 1);
                const markEach = Math.max(0.5, Number(sec.marksPerQ) || 0.5);
                const secTotal = Math.round(count * markEach * 10) / 10;
                totalMaxMarks += secTotal;

                for (let qNo = startNo; qNo <= endNo; qNo++) {
                    const qNumberStr = `Q${qNo}`;
                    const isChoice = !!sec.hasChoice && matchesQuestionSpec(sec.choiceQuestions, qNo);
                    const isSub = !!sec.hasSubQuestions && matchesQuestionSpec(sec.subQuestionNumbers, qNo);

                    const qObj = {
                        qNo: qNo,
                        qNumber: qNumberStr,
                        label: `${qNumberStr} (${sec.name})`,
                        section: sec.name,
                        sectionId: sec.id,
                        maxMarks: markEach,
                        awardedMarks: 0,
                        isChoice: isChoice,
                        choices: isChoice ? [
                            `${qNumberStr} Option 1 (Theory / Principle)`,
                            `${qNumberStr} Option 2 (Application / Problem)`
                        ] : null,
                        selectedChoice: isChoice ? `${qNumberStr} Option 1 (Theory / Principle)` : null,
                        hasSubQuestions: isSub,
                        subQuestions: isSub ? (sec.subQuestions && sec.subQuestions.length > 0 ? sec.subQuestions.map(sq => ({
                            subId: sq.label,
                            label: `${qNo}(${sq.label})`,
                            maxMarks: Number(sq.marks) || 1,
                            awardedMarks: 0,
                            isChoice: !!sq.hasChoice,
                            choices: sq.hasChoice ? [
                                `${qNo}(${sq.label}) Option 1`,
                                `${qNo}(${sq.label}) Option 2`
                            ] : null,
                            selectedChoice: sq.hasChoice ? `${qNo}(${sq.label}) Option 1` : null
                        })) : [
                            { subId: "1", label: `${qNo}(1)`, maxMarks: Math.floor(markEach / 2) || 1, awardedMarks: 0 },
                            { subId: "2", label: `${qNo}(2)`, maxMarks: Math.ceil(markEach / 2) || 1, awardedMarks: 0 }
                        ]) : []
                    };

                    questionList.push(qObj);
                }

                return {
                    id: sec.id,
                    letter: sec.letter,
                    name: sec.name,
                    title: sec.title,
                    qStartNo: startNo,
                    qEndNo: endNo,
                    questionCount: count,
                    marksPerQ: markEach,
                    maxMarks: secTotal,
                    hasChoice: sec.hasChoice,
                    choiceQuestions: sec.choiceQuestions || '',
                    hasSubQuestions: sec.hasSubQuestions,
                    subQuestionNumbers: sec.subQuestionNumbers || ''
                };
            });

            totalMaxMarks = Math.round(totalMaxMarks * 10) / 10;

            if (isEdit && targetItem) {
                targetItem.name = tplName;
                targetItem.examName = `${tplName} 2026`;
                targetItem.maxMarks = totalMaxMarks;
                targetItem.duration = duration;
                targetItem.sections = structuredSections;
                targetItem.questions = questionList;
                targetItem.badge = `${structuredSections.length} Sections (${totalMaxMarks}M)`;
                if (window.app) {
                    window.app.showToast(`Updated template "${tplName}" (${totalMaxMarks} Marks)!`);
                }
            } else {
                const newTemplate = {
                    id: "tpl-" + Date.now(),
                    name: tplName,
                    examName: `${tplName} 2026`,
                    maxMarks: totalMaxMarks,
                    duration: duration,
                    sections: structuredSections,
                    questions: questionList,
                    badge: `${structuredSections.length} Sections (${totalMaxMarks}M)`
                };

                if (!this.selectedSubject.templates) this.selectedSubject.templates = [];
                this.selectedSubject.templates.push(newTemplate);
                this.selectedSubject.badge = this.selectedSubject.templates.length === 1 ? "1 Template" : `${this.selectedSubject.templates.length} Templates`;
                if (window.app) {
                    window.app.showToast(`Created template "${tplName}" (${totalMaxMarks} Marks, ${structuredSections.length} Sections)!`);
                }
            }

            if (window.appStorage) {
                await window.appStorage.saveSubjectCatalog(this.catalog);
            }

            closeModal();
            this.updateStepView();
        });

        // Initialize display
        renderAllSections();
        updateCalculations();

        modalEl.classList.add("active");
    }

    bindCurrentStepEvents() {
        if (this.currentStep === 1) {
            // Subject card selection
            this.container.querySelectorAll(".subject-card").forEach(card => {
                card.addEventListener("click", (e) => {
                    if (e.target.closest(".btn-card-action")) return;
                    const subId = card.getAttribute("data-subject-id");
                    this.selectedSubject = this.catalog.find(s => s.id === subId) || null;
                    this.selectedTemplate = null;
                    this.selectedClass = null;
                    this.currentStep = 2;
                    this.updateStepView();
                });
            });

            // Edit Subject
            this.container.querySelectorAll(".btn-edit-subject").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const subId = btn.getAttribute("data-subject-id");
                    const sub = this.catalog.find(s => s.id === subId);
                    if (sub) this.openEntityModal("subject", sub);
                });
            });

            // Delete Subject with Custom Dialog
            this.container.querySelectorAll(".btn-delete-subject").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const subId = btn.getAttribute("data-subject-id");
                    const sub = this.catalog.find(s => s.id === subId);
                    if (sub) {
                        this.openCustomDeleteModal(
                            "Delete Subject",
                            `Are you sure you want to delete subject "${sub.name}" (${sub.code}) and all its templates?`,
                            async () => {
                                this.catalog = this.catalog.filter(s => s.id !== subId);
                                if (window.appStorage) {
                                    await window.appStorage.saveSubjectCatalog(this.catalog);
                                }
                                if (window.app) window.app.showToast(`Deleted subject "${sub.name}"`);
                                if (this.selectedSubject && this.selectedSubject.id === subId) {
                                    this.selectedSubject = null;
                                }
                                this.updateStepView();
                            }
                        );
                    }
                });
            });

            // Add Subject Button (header button, card, and sidebar)
            this.container.querySelectorAll(".btn-create-subject-trigger").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.openEntityModal("subject");
                });
            });
        } else if (this.currentStep === 2) {
            // Back button
            const back1 = this.container.querySelector("#btn-back-to-step1");
            if (back1) back1.addEventListener("click", () => {
                this.currentStep = 1;
                this.updateStepView();
            });

            // Template card selection
            this.container.querySelectorAll(".template-card").forEach(card => {
                card.addEventListener("click", (e) => {
                    if (e.target.closest(".btn-card-action")) return; // Don't trigger select when clicking edit/delete
                    const tplId = card.getAttribute("data-template-id");
                    this.selectedTemplate = this.selectedSubject?.templates.find(t => t.id === tplId) || null;
                    this.selectedClass = null;
                    this.currentStep = 3;
                    this.updateStepView();
                });
            });

            // Edit template
            this.container.querySelectorAll(".btn-edit-template").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const tplId = btn.getAttribute("data-template-id");
                    const tpl = this.selectedSubject?.templates.find(t => t.id === tplId);
                    if (tpl) this.openAdvancedTemplateModal(tpl);
                });
            });

            // Duplicate / Copy template
            this.container.querySelectorAll(".btn-duplicate-template").forEach(btn => {
                btn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    const tplId = btn.getAttribute("data-template-id");
                    const tpl = this.selectedSubject?.templates.find(t => t.id === tplId);
                    if (tpl) {
                        const duplicated = JSON.parse(JSON.stringify(tpl));
                        duplicated.id = "tpl-" + Date.now();
                        duplicated.name = `${tpl.name} (Copy)`;
                        duplicated.examName = `${tpl.examName} (Copy)`;

                        this.selectedSubject.templates.push(duplicated);
                        this.selectedSubject.badge = this.selectedSubject.templates.length === 1 ? "1 Template" : `${this.selectedSubject.templates.length} Templates`;
                        if (window.appStorage) {
                            await window.appStorage.saveSubjectCatalog(this.catalog);
                        }
                        if (window.app) window.app.showToast(`Duplicated template "${tpl.name}"!`);
                        this.updateStepView();
                    }
                });
            });

            // Delete template with Custom Dialog
            this.container.querySelectorAll(".btn-delete-template").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const tplId = btn.getAttribute("data-template-id");
                    const tpl = this.selectedSubject?.templates.find(t => t.id === tplId);
                    if (tpl) {
                        this.openCustomDeleteModal(
                            "Delete Exam Template",
                            `Are you sure you want to delete template "${tpl.name}"? This action cannot be undone.`,
                            async () => {
                                this.selectedSubject.templates = this.selectedSubject.templates.filter(t => t.id !== tplId);
                                this.selectedSubject.badge = this.selectedSubject.templates.length === 1 ? "1 Template" : `${this.selectedSubject.templates.length} Templates`;
                                if (window.appStorage) {
                                    await window.appStorage.saveSubjectCatalog(this.catalog);
                                }
                                if (window.app) window.app.showToast(`Deleted template "${tpl.name}"`);
                                this.updateStepView();
                            }
                        );
                    }
                });
            });

            // Add Template Button (header button and card)
            this.container.querySelectorAll(".btn-create-template-trigger").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.openAdvancedTemplateModal();
                });
            });
        } else if (this.currentStep === 3) {
            // Back button
            const back2 = this.container.querySelector("#btn-back-to-step2");
            if (back2) back2.addEventListener("click", () => {
                this.currentStep = 2;
                this.updateStepView();
            });

            // Class selection
            this.container.querySelectorAll(".class-card").forEach(card => {
                card.addEventListener("click", async () => {
                    const clsId = card.getAttribute("data-class-id");
                    this.selectedClass = this.classes.find(c => c.id === clsId) || null;
                    this.currentStep = 4;
                    await this.loadClassRoster();
                    this.updateStepView();
                    this.loadExistingClassPapers();
                });
            });

            // Add Class Button
            const btnAddCls = this.container.querySelector("#btn-add-class-card");
            if (btnAddCls) {
                btnAddCls.addEventListener("click", () => this.openEntityModal("class"));
            }
        } else if (this.currentStep === 4) {
            // Back button
            const back3 = this.container.querySelector("#btn-back-to-step3");
            if (back3) back3.addEventListener("click", () => {
                this.currentStep = 3;
                this.updateStepView();
            });

                        // Demo CSV Template Download
            const btnDemoCsv = this.container.querySelector("#btn-download-demo-csv");
            if (btnDemoCsv) {
                btnDemoCsv.addEventListener("click", () => this.downloadDemoCsvTemplate());
            }

            // CSV Roster Import
            const btnImportCsv = this.container.querySelector("#btn-import-roster-csv");
            const inpCsvFile = this.container.querySelector("#inp-roster-csv-file");
            if (btnImportCsv && inpCsvFile) {
                btnImportCsv.addEventListener("click", () => inpCsvFile.click());
                inpCsvFile.addEventListener("change", async (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        await this.handleRosterCsvUpload(e.target.files[0]);
                    }
                });
            }

            // Reload 25-Student Demo Roster
            const btnReloadRoster = this.container.querySelector("#btn-reload-demo-roster");
            if (btnReloadRoster && this.selectedClass) {
                btnReloadRoster.addEventListener("click", async () => {
                    this.currentClassRoster = this.generateFallbackRoster(this.selectedClass.id);
                    if (window.appStorage) {
                        await window.appStorage.saveClassRoster(this.selectedClass.id, this.currentClassRoster);
                    }
                    this.updateStepView();
                });
            }

            // Reconciliation Filter Buttons
            this.container.querySelectorAll(".btn-recon-filter").forEach(btn => {
                btn.addEventListener("click", () => {
                    this.rosterFilter = btn.getAttribute("data-filter");
                    this.updateStepView();
                });
            });

            // Reconciliation Ticking Checkboxes (Persisted to localStorage)
            this.container.querySelectorAll(".recon-check-box").forEach(cb => {
                cb.addEventListener("change", (e) => {
                    const roll = String(cb.getAttribute("data-roll") || "").trim();
                    if (e.target.checked) {
                        this.manualCheckedRolls.add(roll);
                    } else {
                        this.manualCheckedRolls.delete(roll);
                    }
                    this.saveManualChecks();
                    this.updateStepView();
                });
            });

            // Clean Up Unwanted / Demo Data Button
            const cleanDataBtn = this.container.querySelector("#btn-portal-clean-data");
            if (cleanDataBtn) {
                cleanDataBtn.addEventListener("click", () => this.openCleanUpConfirmationModal());
            }

            // Single student attach PDF trigger
            const inpSinglePdf = this.container.querySelector("#inp-single-student-pdf-file");
            this.container.querySelectorAll(".btn-attach-single-pdf").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const roll = btn.getAttribute("data-roll");
                    const name = btn.getAttribute("data-name");
                    this.activeTargetStudentForUpload = { rollNo: roll, studentName: name };
                    if (inpSinglePdf) inpSinglePdf.click();
                });
            });

            if (inpSinglePdf) {
                inpSinglePdf.addEventListener("change", async (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        await this.handleIncomingFiles(e.target.files, this.activeTargetStudentForUpload);
                        this.activeTargetStudentForUpload = null;
                        this.updateStepView();
                    }
                });
            }

            // Drag and Drop Zone
            const dropzone = this.container.querySelector("#portal-pdf-dropzone");
            const fileInput = this.container.querySelector("#portal-pdf-file-input");
            const browseBtn = this.container.querySelector("#btn-portal-browse-pdf");

            if (browseBtn && fileInput) {
                browseBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    fileInput.click();
                });
            }

            if (dropzone) {
                dropzone.addEventListener("click", () => fileInput && fileInput.click());
                dropzone.addEventListener("dragover", (e) => {
                    e.preventDefault();
                    dropzone.classList.add("dragover");
                });
                dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
                dropzone.addEventListener("drop", async (e) => {
                    e.preventDefault();
                    dropzone.classList.remove("dragover");
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        await this.handleIncomingFiles(e.dataTransfer.files);
                    }
                });
            }

            if (fileInput) {
                fileInput.addEventListener("change", async (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        await this.handleIncomingFiles(e.target.files);
                    }
                });
            }

            // Quick Generate Sample Student PDF
            const sampleBtn = this.container.querySelector("#btn-load-sample-student-pdf");
            if (sampleBtn) {
                sampleBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.addSampleStudentPaper();
                });
            }

            // Clear Queue button
            const clearBtn = this.container.querySelector("#btn-clear-queue");
            if (clearBtn) {
                clearBtn.addEventListener("click", () => {
                    this.fileQueue = [];
                    this.refreshQueueUI();
                });
            }

            // Publish Batch to Evaluator Desk
            const publishBtn = this.container.querySelector("#btn-publish-batch");
            if (publishBtn) {
                publishBtn.addEventListener("click", () => this.publishQueueToStorage());
            }

            // Queue inputs sync
            this.bindQueueInputs();
            this.loadExistingClassPapers();
        }
    }

    bindQueueInputs() {
        this.container.querySelectorAll(".queue-student-name-inp").forEach(inp => {
            inp.addEventListener("input", (e) => {
                const idx = Number(inp.getAttribute("data-index"));
                if (this.fileQueue[idx]) {
                    this.fileQueue[idx].studentName = e.target.value.trim();
                }
            });
        });

        this.container.querySelectorAll(".queue-roll-inp").forEach(inp => {
            inp.addEventListener("input", (e) => {
                const idx = Number(inp.getAttribute("data-index"));
                if (this.fileQueue[idx]) {
                    this.fileQueue[idx].rollNo = e.target.value.trim();
                }
            });
        });

        this.container.querySelectorAll(".btn-remove-queue-item").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = Number(btn.getAttribute("data-index"));
                this.fileQueue.splice(idx, 1);
                this.refreshQueueUI();
            });
        });
    }

    updateStepView() {
        this.render();
        this.bindEvents();
    }

    refreshQueueUI() {
        const queueContainer = this.container.querySelector("#file-queue-container");
        const list = this.container.querySelector("#queue-items-list");
        const headerTitle = this.container.querySelector(".queue-title");
        const clearBtn = this.container.querySelector("#btn-clear-queue");
        const pubBtnText = this.container.querySelector("#btn-publish-batch-text");
        const sidePubBtn = this.container.querySelector("#btn-side-publish-queue");

        const readyCount = (this.fileQueue || []).filter(i => i.isReady).length;

        if (pubBtnText) {
            pubBtnText.textContent = `Publish Papers to Teacher Evaluator Desk (${readyCount} Ready)`;
        }
        if (sidePubBtn) {
            sidePubBtn.textContent = `Publish Batch (${readyCount} Ready)`;
        }
        if (clearBtn) {
            clearBtn.style.display = this.fileQueue.length > 0 ? "inline-block" : "none";
        }

        if (!queueContainer || !list) return;

        queueContainer.style.display = "block";
        if (headerTitle) {
            headerTitle.textContent = `PDF Ingestion Queue (${this.fileQueue.length} Document${this.fileQueue.length === 1 ? '' : 's'})`;
        }
        list.innerHTML = this.renderQueueItems();
        this.bindQueueInputs();
    }

    parseFilenameForStudentInfo(filename) {
        const baseName = filename.replace(/\.[^/.]+$/, "").trim();
        let possibleName = baseName;
        let possibleRoll = "";

        const parts = baseName.split(/[\s_\-]+/).filter(Boolean);
        if (parts.length >= 2) {
            const lastPart = parts[parts.length - 1];
            const firstPart = parts[0];

            if (/^\d+$/.test(lastPart)) {
                possibleRoll = lastPart;
                possibleName = parts.slice(0, -1).join(" ");
            } else if (/^\d+$/.test(firstPart)) {
                possibleRoll = firstPart;
                possibleName = parts.slice(1).join(" ");
            } else {
                const numIdx = parts.findIndex(p => /^\d+$/.test(p));
                if (numIdx >= 0) {
                    possibleRoll = parts[numIdx];
                    const nameTokens = parts.filter((_, idx) => idx !== numIdx);
                    possibleName = nameTokens.join(" ");
                }
            }
        }

        // Clean up title case
        possibleName = possibleName.replace(/\b\w/g, l => l.toUpperCase());

        // Cross-match with active class roster if available
        if (this.currentClassRoster && this.currentClassRoster.length > 0) {
            const matchedStudent = this.currentClassRoster.find(s => {
                const sRoll = String(s.rollNo || "").trim();
                const sName = String(s.studentName || "").toLowerCase().trim();
                if (possibleRoll && sRoll === possibleRoll) return true;
                if (possibleName && sName === possibleName.toLowerCase().trim()) return true;
                return false;
            });

            if (matchedStudent) {
                possibleName = matchedStudent.studentName;
                possibleRoll = matchedStudent.rollNo;
            }
        }

        return {
            studentName: possibleName || baseName,
            rollNo: possibleRoll || String(100 + (this.fileQueue ? this.fileQueue.length : 0) + 1)
        };
    }

    // --- Ingestion & PDF/Image Parsing ---
    async handleIncomingFiles(files, targetStudent = null) {
        if (!files || files.length === 0) return;

        // Prevent repeated or concurrent uploads
        if (this.isUploading) {
            if (window.app && window.app.showToast) {
                window.app.showToast("An upload is currently in progress. Please wait for it to finish.", "warning");
            }
            return;
        }

        this.isUploading = true;

        // Lock dropzone, file inputs, and browse buttons to prevent double-upload
        const dropzone = this.container.querySelector("#portal-pdf-dropzone");
        const fileInput = this.container.querySelector("#portal-pdf-file-input");
        const browseBtn = this.container.querySelector("#btn-portal-browse-pdf");
        const singleFileInp = this.container.querySelector("#inp-single-student-pdf-file");

        if (dropzone) {
            dropzone.style.pointerEvents = "none";
            dropzone.style.opacity = "0.7";
        }
        if (fileInput) fileInput.disabled = true;
        if (singleFileInp) singleFileInp.disabled = true;
        if (browseBtn) browseBtn.disabled = true;

        // Immediately show and initialize batch progress banner
        const banner = this.container.querySelector("#batch-upload-progress-banner");
        if (banner) {
            banner.style.display = "block";
            const titleEl = this.container.querySelector("#batch-progress-title");
            if (titleEl) titleEl.textContent = `Validating & Ingesting ${files.length} answer sheet(s)...`;
            const pctEl = this.container.querySelector("#batch-progress-pct");
            if (pctEl) pctEl.textContent = "5%";
            const fillEl = this.container.querySelector("#batch-progress-fill");
            if (fillEl) fillEl.style.width = "5%";
        }

        try {
            const MAX_FILE_SIZE = 5 * 1024 * 1024; // Strict 5MB limit
            let duplicateCount = 0;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
                const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name);

                if (!isPdf && !isImage) {
                    alert(`File "${file.name}" is not supported. Please upload PDF or image answer sheet files.`);
                    continue;
                }

                // Enforce strict 5MB limit per file
                if (file.size > MAX_FILE_SIZE) {
                    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
                    this.showFileSizeLimitModal(file.name, sizeMb);
                    continue;
                }

                let possibleRoll = targetStudent ? String(targetStudent.rollNo).trim() : "";
                let possibleName = targetStudent ? String(targetStudent.studentName).trim() : "";

                if (!targetStudent) {
                    const extracted = this.parseFilenameForStudentInfo(file.name);
                    possibleName = extracted.studentName;
                    possibleRoll = extracted.rollNo;
                }

                // --- DUPLICATE PREVENTION ---
                // 1. Check if already staged in this.fileQueue
                const isDuplicateInQueue = (this.fileQueue || []).some(item => {
                    const rollMatch = possibleRoll && String(item.rollNo).trim() === possibleRoll;
                    const nameMatch = possibleName && String(item.studentName).toLowerCase().trim() === possibleName.toLowerCase();
                    const fileMatch = item.fileName && item.fileName.toLowerCase() === file.name.toLowerCase();
                    return rollMatch || nameMatch || fileMatch;
                });

                // 2. Check if already uploaded/published in this class
                const isDuplicateInExisting = (this.existingPapers || []).some(paper => {
                    const rollMatch = possibleRoll && String(paper.rollNo).trim() === possibleRoll;
                    const nameMatch = possibleName && String(paper.studentName).toLowerCase().trim() === possibleName.toLowerCase();
                    return rollMatch || nameMatch;
                });

                if (isDuplicateInQueue || isDuplicateInExisting) {
                    duplicateCount++;
                    const reason = isDuplicateInQueue ? "already in upload queue" : "already uploaded for this class";
                    if (window.app && window.app.showToast) {
                        window.app.showToast(`Duplicate skipped: Roll ${possibleRoll} (${possibleName}) is ${reason}.`, "warning");
                    }
                    continue;
                }

                const queueItem = {
                    file: file,
                    fileName: file.name,
                    studentName: possibleName || `Student ${this.fileQueue.length + 1}`,
                    rollNo: possibleRoll || String(100 + this.fileQueue.length + 1),
                    pages: [],
                    pageCount: 1,
                    thumbnail: null,
                    pdfDataUrl: null,
                    isProcessing: true,
                    isReady: false
                };

                this.fileQueue.push(queueItem);
                this.refreshQueueUI();

                if (isImage) {
                    await this.extractImagePages(queueItem);
                } else {
                    await this.extractPdfPages(queueItem);
                }
                this.refreshQueueUI();
            }

            if (duplicateCount > 0 && window.app && window.app.showToast) {
                window.app.showToast(`Ingestion complete: ${duplicateCount} duplicate paper(s) were safely ignored.`, "info");
            }
        } finally {
            this.isUploading = false;

            // Re-enable dropzone, inputs, and clear file input value so user can upload next batch
            if (dropzone) {
                dropzone.style.pointerEvents = "";
                dropzone.style.opacity = "";
            }
            if (fileInput) {
                fileInput.disabled = false;
                fileInput.value = "";
            }
            if (singleFileInp) {
                singleFileInp.disabled = false;
                singleFileInp.value = "";
            }
            if (browseBtn) browseBtn.disabled = false;

            this.refreshQueueUI();
            this.updateBatchProgress();
        }
    }

    updateBatchProgress() {
        const banner = this.container.querySelector("#batch-upload-progress-banner");
        if (!banner) return;

        const processingItems = this.fileQueue.filter(i => i.isProcessing);
        if (processingItems.length === 0) {
            banner.style.display = "none";
            return;
        }

        banner.style.display = "block";
        const totalItems = this.fileQueue.length;
        const totalProgressSum = this.fileQueue.reduce((sum, item) => sum + (item.progressPercent !== undefined ? item.progressPercent : (item.isReady ? 100 : 0)), 0);
        const overallPct = Math.round(totalProgressSum / totalItems);

        const titleEl = this.container.querySelector("#batch-progress-title");
        if (titleEl) titleEl.textContent = `Processing & Ingesting ${totalItems} Answer Sheet PDF${totalItems > 1 ? 's' : ''}... (${totalItems - processingItems.length} of ${totalItems} Complete)`;

        const pctEl = this.container.querySelector("#batch-progress-pct");
        if (pctEl) pctEl.textContent = `${overallPct}%`;

        const fillEl = this.container.querySelector("#batch-progress-fill");
        if (fillEl) fillEl.style.width = `${overallPct}%`;
    }

    updateQueueItemProgress(queueItem, idx) {
        const itemIdx = idx !== undefined ? idx : this.fileQueue.indexOf(queueItem);
        if (itemIdx < 0) return;

        const pct = queueItem.progressPercent !== undefined ? queueItem.progressPercent : (queueItem.isReady ? 100 : 0);
        const statusMsg = queueItem.statusText || (queueItem.isProcessing ? "Processing PDF pages..." : `${queueItem.pages.length} Pages Extracted via PDF.js`);

        const statusEl = this.container.querySelector(`#queue-status-text-${itemIdx}`);
        if (statusEl) statusEl.textContent = statusMsg;

        const pctLabel = this.container.querySelector(`#queue-pct-label-${itemIdx}`);
        if (pctLabel) pctLabel.textContent = queueItem.isReady ? '✓ PDF Processing Complete' : `Uploading & Ingesting (${pct}%)`;

        const pctVal = this.container.querySelector(`#queue-pct-val-${itemIdx}`);
        if (pctVal) pctVal.textContent = `${pct}%`;

        const fillEl = this.container.querySelector(`#queue-progress-fill-${itemIdx}`);
        if (fillEl) {
            fillEl.style.width = `${pct}%`;
            if (queueItem.isReady) {
                fillEl.classList.remove("fill-active");
                fillEl.classList.add("fill-complete");
            }
        }

        const card = this.container.querySelector(`#queue-item-card-${itemIdx}`);
        if (card && queueItem.isReady) {
            card.classList.remove("processing");
            card.classList.add("ready");
        }

        this.updateBatchProgress();

        // Dynamically update Publish Button ready counts
        const readyCount = (this.fileQueue || []).filter(i => i.isReady).length;
        const pubBtnText = this.container.querySelector("#btn-publish-batch-text");
        if (pubBtnText) {
            pubBtnText.textContent = `Publish Papers to Teacher Evaluator Desk (${readyCount} Ready)`;
        }
        const sidePubBtn = this.container.querySelector("#btn-side-publish-queue");
        if (sidePubBtn) {
            sidePubBtn.textContent = `Publish Batch (${readyCount} Ready)`;
        }
    }

    async extractImagePages(queueItem) {
        queueItem.isProcessing = true;
        queueItem.isReady = false;
        queueItem.progressPercent = 20;
        queueItem.statusText = "Reading image file buffer...";
        this.updateQueueItemProgress(queueItem);

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onprogress = (e) => {
                if (e.lengthComputable) {
                    const loadedPct = Math.round(20 + (e.loaded / e.total) * 75);
                    queueItem.progressPercent = loadedPct;
                    queueItem.statusText = `Compressing & Ingesting Image (${loadedPct}%)...`;
                    this.updateQueueItemProgress(queueItem);
                }
            };
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Downscale and compress image if large to ensure high performance
                    const maxDim = 1400;
                    let w = img.width;
                    let h = img.height;
                    if (w > maxDim || h > maxDim) {
                        if (w > h) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, w, h);
                    const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.80);

                    queueItem.pages = [compressedDataUrl];
                    queueItem.progressPercent = 100;
                    queueItem.statusText = "✓ Image Compressed & Ready (1 Page)";
                    queueItem.isProcessing = false;
                    queueItem.isReady = true;
                    this.updateQueueItemProgress(queueItem);
                    resolve();
                };
                img.onerror = () => {
                    queueItem.pages = [e.target.result];
                    queueItem.progressPercent = 100;
                    queueItem.statusText = "✓ Image Extracted (1 Page)";
                    queueItem.isProcessing = false;
                    queueItem.isReady = true;
                    this.updateQueueItemProgress(queueItem);
                    resolve();
                };
                img.src = e.target.result;
            };
            reader.onerror = () => {
                queueItem.pages = [];
                queueItem.progressPercent = 100;
                queueItem.statusText = "Error reading image file";
                queueItem.isProcessing = false;
                queueItem.isReady = false;
                this.updateQueueItemProgress(queueItem);
                resolve();
            };
            reader.readAsDataURL(queueItem.file);
        });
    }

    async extractPdfPages(queueItem) {
        queueItem.isProcessing = true;
        queueItem.isReady = false;
        queueItem.progressPercent = 10;
        queueItem.statusText = "Reading PDF file buffer...";
        this.updateQueueItemProgress(queueItem);

        // Always generate a raw PDF Data URL payload from the uploaded file
        try {
            if (queueItem.file) {
                queueItem.pdfDataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(queueItem.file);
                });
            }
        } catch (e) {
            console.warn("Failed to generate raw PDF Data URL:", e);
        }

        // Wait for pdfjsLib to finish initializing if script is loading
        if (!window.pdfjsLib && window.ensurePdfJs) {
            await window.ensurePdfJs(6000);
        } else if (!window.pdfjsLib && window.CanvasEngine && window.CanvasEngine.ensurePdfJs) {
            await window.CanvasEngine.ensurePdfJs(6000);
        } else {
            let attempts = 0;
            while (!window.pdfjsLib && attempts < 30) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }
        }

        if (!window.pdfjsLib) {
            console.warn("PDF.js unavailable, using single PDF data URL payload");
            queueItem.pages = queueItem.pdfDataUrl ? [queueItem.pdfDataUrl] : [];
            queueItem.pageCount = 1;
            queueItem.progressPercent = 100;
            queueItem.statusText = `✓ Complete (PDF Document Ready)`;
            queueItem.isProcessing = false;
            queueItem.isReady = true;
            queueItem.isUserUploaded = true;
            this.updateQueueItemProgress(queueItem);
            return;
        }

        try {
            queueItem.progressPercent = 35;
            queueItem.statusText = "Parsing PDF document structure...";
            this.updateQueueItemProgress(queueItem);

            const arrayBuffer = await queueItem.file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const numPages = pdf.numPages;
            queueItem.pageCount = numPages;

            queueItem.progressPercent = 65;
            queueItem.statusText = `PDF Loaded: ${numPages} Page${numPages === 1 ? '' : 's'}. Generating cover preview...`;
            this.updateQueueItemProgress(queueItem);

            // Generate ONLY the Page 1 thumbnail for fast UI preview (saving only the single optimized PDF!)
            try {
                const page1 = await pdf.getPage(1);
                const unscaled = page1.getViewport({ scale: 1.0 });
                const optScale = Math.min(1.0, 360 / unscaled.width);
                const viewport = page1.getViewport({ scale: optScale });
                const canvas = document.createElement("canvas");
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext("2d");
                await page1.render({ canvasContext: ctx, viewport }).promise;
                queueItem.thumbnail = canvas.toDataURL("image/jpeg", 0.80);
            } catch (tErr) {
                console.warn("Could not generate Page 1 thumbnail:", tErr);
            }

            // Save single optimized PDF reference in pages array
            queueItem.pages = [queueItem.thumbnail || queueItem.pdfDataUrl];
            queueItem.progressPercent = 100;
            queueItem.statusText = `✓ Complete (${numPages} Pages Optimized PDF Ready)`;
            queueItem.isProcessing = false;
            queueItem.isReady = true;
            queueItem.isUserUploaded = true;
            this.updateQueueItemProgress(queueItem);
        } catch (err) {
            console.error("PDF Parsing error:", err);
            // Fallback to raw PDF Data URL
            queueItem.pages = queueItem.pdfDataUrl ? [queueItem.pdfDataUrl] : [];
            queueItem.pageCount = 1;
            queueItem.progressPercent = 100;
            queueItem.statusText = `✓ Uploaded PDF Document Ready`;
            queueItem.isProcessing = false;
            queueItem.isReady = true;
            queueItem.isUserUploaded = true;
            this.updateQueueItemProgress(queueItem);
        }
    }

    // --- 1-Click Sample Student Paper Generator ---
    addSampleStudentPaper() {
        alert("Please browse or drop your actual Physics PDF answer sheet file to upload.");
    }

    // --- 5MB Limit Modal ---
    showFileSizeLimitModal(fileName, sizeMb) {
        const modalId = "modal-file-size-error";
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const backdrop = document.createElement("div");
        backdrop.id = modalId;
        backdrop.className = "publish-loading-backdrop";
        backdrop.innerHTML = `
            <div class="publish-loading-card" style="max-width: 440px;">
                <div class="publish-modal-icon-wrap" style="background: rgba(245, 158, 11, 0.1); border: 2px solid rgba(245, 158, 11, 0.25);">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <h3 class="publish-modal-title">File Exceeds 5MB Limit</h3>
                <p class="publish-modal-subtitle">
                    The file <strong style="color: var(--text-main); font-weight: 600;">"${fileName}"</strong> (${sizeMb} MB) exceeds the strict <strong>5MB file limit</strong>.
                </p>
                <div class="publish-pills-row">
                    <span class="publish-badge-pill pill-orange">Max Size: 5.0 MB</span>
                    <span class="publish-badge-pill">Auto Compression Active</span>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 24px;">
                    To protect browser stability and ensure fast page rendering for evaluators, answer sheets must be under 5MB. Please compress your document before uploading.
                </p>
                <div class="publish-modal-actions">
                    <button type="button" class="publish-btn-primary" id="btn-close-size-modal">Understand & Select Again</button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);
        const closeBtn = backdrop.querySelector("#btn-close-size-modal");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => backdrop.remove());
        }
        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) backdrop.remove();
        });
    }

    // --- Informative Zero-Ready Dialog ---
    showZeroReadyModal() {
        const modalId = "modal-zero-ready-info";
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const backdrop = document.createElement("div");
        backdrop.id = modalId;
        backdrop.className = "publish-loading-backdrop";
        backdrop.innerHTML = `
            <div class="publish-loading-card" style="max-width: 480px;">
                <div class="publish-modal-icon-wrap" style="background: rgba(0, 122, 255, 0.1); border: 2px solid rgba(0, 122, 255, 0.25);">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="12 18 12 12 9 15"/><polyline points="12 12 15 15"/></svg>
                </div>
                <h3 class="publish-modal-title">No Papers Ready in Queue</h3>
                <p class="publish-modal-subtitle">
                    There are currently <strong>0 answer sheets</strong> staged for publishing to the Teacher Evaluator Desk.
                </p>
                <div class="publish-pills-row">
                    <span class="publish-badge-pill pill-green">5MB Strict Limit</span>
                    <span class="publish-badge-pill">High-DPI Compression</span>
                    <span class="publish-badge-pill">Cloud Server Sync</span>
                </div>
                <div class="publish-progress-section" style="text-align: left; margin-bottom: 20px;">
                    <div style="font-size: 0.85rem; color: var(--text-main); font-weight: 500; margin-bottom: 6px;">How to Publish Answer Sheets:</div>
                    <ul style="margin: 0; padding-left: 20px; font-size: 0.82rem; color: var(--text-muted); line-height: 1.6;">
                        <li>Drop or select student PDF answer sheets (Max 5MB each).</li>
                        <li>The system automatically detects student names & rolls.</li>
                        <li>Pages are compressed (JPEG 0.80) to maximize loading speed.</li>
                        <li>Click "Publish Papers" to make them live on the Evaluator Desk.</li>
                    </ul>
                </div>
                <div class="publish-modal-actions">
                    <button type="button" class="publish-btn-secondary" id="btn-close-zero-modal">Close</button>
                    <button type="button" class="publish-btn-primary" id="btn-upload-from-zero-modal">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span>Select Answer Sheets (&lt;5MB)</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);
        const closeBtn = backdrop.querySelector("#btn-close-zero-modal");
        const uploadBtn = backdrop.querySelector("#btn-upload-from-zero-modal");
        if (closeBtn) closeBtn.addEventListener("click", () => backdrop.remove());
        if (uploadBtn) {
            uploadBtn.addEventListener("click", () => {
                backdrop.remove();
                const fileInp = this.container.querySelector("#portal-pdf-file-input");
                if (fileInp) fileInp.click();
            });
        }
        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) backdrop.remove();
        });
    }

    // --- Publishing Loading Dialog ---
    showPublishLoadingDialog(totalCount) {
        const modalId = "modal-publish-loading-dialog";
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const backdrop = document.createElement("div");
        backdrop.id = modalId;
        backdrop.className = "publish-loading-backdrop";
        backdrop.innerHTML = `
            <div class="publish-loading-card" id="publish-loading-card">
                <div class="publish-modal-icon-wrap" id="publish-dialog-icon">
                    <div class="publish-spinner-circle"></div>
                </div>
                <h3 class="publish-modal-title" id="publish-dialog-title">Publishing Papers to Teacher Desk</h3>
                <p class="publish-modal-subtitle" id="publish-dialog-subtitle">
                    Optimizing, compressing, and dispatching <strong id="publish-dialog-count">${totalCount}</strong> answer sheet(s)...
                </p>
                <div class="publish-pills-row">
                    <span class="publish-badge-pill pill-green">5MB Limit Enforced</span>
                    <span class="publish-badge-pill">0.80 JPEG Compression</span>
                </div>
                <div class="publish-progress-section">
                    <div class="publish-progress-row">
                        <span class="publish-progress-status" id="publish-dialog-status">Initializing batch upload...</span>
                        <span class="publish-progress-percent" id="publish-dialog-percent">0%</span>
                    </div>
                    <div class="publish-track">
                        <div class="publish-bar" id="publish-dialog-bar" style="width: 0%;"></div>
                    </div>
                </div>
                <div class="publish-modal-actions" id="publish-dialog-actions" style="display: none;">
                    <button type="button" class="publish-btn-primary" id="btn-dialog-done">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Done & View Evaluator Desk</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);
    }

    updatePublishDialogProgress(current, total, percent, statusText) {
        const statusEl = document.getElementById("publish-dialog-status");
        const percentEl = document.getElementById("publish-dialog-percent");
        const barEl = document.getElementById("publish-dialog-bar");

        if (statusEl) statusEl.textContent = statusText || `Publishing paper ${current} of ${total}...`;
        if (percentEl) percentEl.textContent = `${percent}%`;
        if (barEl) barEl.style.width = `${percent}%`;
    }

    setPublishDialogComplete(publishedCount) {
        const iconWrap = document.getElementById("publish-dialog-icon");
        const titleEl = document.getElementById("publish-dialog-title");
        const subEl = document.getElementById("publish-dialog-subtitle");
        const statusEl = document.getElementById("publish-dialog-status");
        const percentEl = document.getElementById("publish-dialog-percent");
        const barEl = document.getElementById("publish-dialog-bar");
        const actionsEl = document.getElementById("publish-dialog-actions");

        if (iconWrap) {
            iconWrap.innerHTML = `
                <div style="width: 58px; height: 58px; border-radius: 50%; background: #34C759; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(52, 199, 89, 0.4);">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
            `;
        }

        if (titleEl) titleEl.textContent = "✓ Published to Evaluator Desk!";
        if (subEl) subEl.textContent = `All ${publishedCount} answer sheet(s) have been compressed, optimized, and published successfully.`;
        if (statusEl) statusEl.textContent = "✓ Ingestion and synchronization complete.";
        if (percentEl) percentEl.textContent = "100%";
        if (barEl) {
            barEl.style.width = "100%";
            barEl.style.background = "#34C759";
        }
        if (actionsEl) {
            actionsEl.style.display = "flex";
            const doneBtn = actionsEl.querySelector("#btn-dialog-done");
            if (doneBtn) {
                doneBtn.addEventListener("click", () => {
                    const backdrop = document.getElementById("modal-publish-loading-dialog");
                    if (backdrop) backdrop.remove();
                });
            }
        }

        // Auto-dismiss after 800ms if user doesn't click
        setTimeout(() => {
            const backdrop = document.getElementById("modal-publish-loading-dialog");
            if (backdrop) backdrop.remove();
        }, 800);
    }

    // --- Publish to Storage & Evaluator Desk ---
    async publishQueueToStorage() {
        const readyItems = (this.fileQueue || []).filter(item => item.isReady);

        if (readyItems.length === 0) {
            this.showZeroReadyModal();
            return;
        }

        // Check 50.0 GB Institution Storage Quota Limit
        if (window.appStorage && typeof window.appStorage.getStorageUsage === "function") {
            const storageInfo = await window.appStorage.getStorageUsage();
            if (storageInfo.isExceeded) {
                alert(`⚠️ 50.0 GB Institution Storage Quota Reached!\n\nCurrently used: ${storageInfo.usedGB} GB of 50.0 GB limit (${storageInfo.percentUsed}%).\n\nPlease delete older evaluated batches or completed examination papers from the Dashboard or Uploaded Papers Repository to free up storage space before uploading new answer scripts.`);
                return;
            }
        }

        // Show the loading dialog with real-time feedback
        this.showPublishLoadingDialog(readyItems.length);

        const subject = this.selectedSubject || (this.catalog && this.catalog[0]) || { name: "Physics" };
        const template = this.selectedTemplate || (subject.templates ? subject.templates[0] : null) || { name: "Physics Board Paper (33 Qs / 70 Marks)", maxMarks: 70, id: "phy-cbse-70" };
        const cls = this.selectedClass || (this.classes && this.classes[0]) || { name: "Class 12", section: "A", label: "Class 12-A" };

        let publishedCount = 0;
        const total = readyItems.length;

        for (let i = 0; i < total; i++) {
            const item = readyItems[i];
            const startPct = Math.round((i / total) * 90);
            this.updatePublishDialogProgress(i + 1, total, startPct, `Optimizing & saving paper for ${item.studentName}...`);

            // Build standardized question list based on selected template
            const questions = (template.questions || []).map((q, idx) => {
                const sName = q.section || (q.sectionName || "Section A");
                let sId = q.sectionId;
                const match = sName.match(/Section\s+([A-Za-z])/i);
                if (match) {
                    sId = `sec_${match[1].toLowerCase()}`;
                } else if (!sId) {
                    sId = "sec_a";
                }
                return {
                    id: q.id || `q${idx + 1}`,
                    qNo: q.qNo !== undefined ? q.qNo : idx + 1,
                    number: q.qNumber || `Q${idx + 1}`,
                    label: q.label || `${q.qNumber || `Q${idx + 1}`}. ${q.topic || ''}`,
                    section: sName,
                    sectionId: sId,
                    maxMarks: Number(q.maxMarks) || 1,
                    awardedMarks: 0,
                    obtainedMarks: 0,
                    status: "unmarked",
                    remarks: "",
                    isChoice: !!q.isChoice,
                    choices: q.choices ? JSON.parse(JSON.stringify(q.choices)) : null,
                    selectedChoice: q.selectedChoice || (q.choices ? (typeof q.choices[0] === 'string' ? q.choices[0] : q.choices[0].label) : null),
                    hasSubQuestions: !!q.hasSubQuestions,
                    subQuestions: q.subQuestions ? q.subQuestions.map(sq => ({
                        subId: sq.subId || sq.letter,
                        label: sq.label || `(${sq.subId || sq.letter})`,
                        maxMarks: Number(sq.maxMarks) || 1,
                        awardedMarks: 0
                    })) : []
                };
            });

            // Check if paper already exists for this student in this class & exam:
            const rollKey = String(item.rollNo || "").trim().toLowerCase();
            const nameKey = String(item.studentName || "").trim().toLowerCase();
            const existingMatch = (this.existingPapers || []).find(p => {
                const pRoll = String(p.rollNo || "").trim().toLowerCase();
                const pName = String(p.studentName || "").trim().toLowerCase();
                if (rollKey && pRoll && rollKey === pRoll) return true;
                if (nameKey && pName && nameKey === pName) return true;
                return false;
            });

            // Overwrite existing paper if found, rather than creating a duplicate!
            const evalId = item.id || (existingMatch ? existingMatch.id : `eval-${Date.now()}-${Math.floor(Math.random() * 100000)}`);

            const newEvaluation = {
                id: evalId,
                rawFile: item.file || null,
                studentName: item.studentName || (existingMatch ? existingMatch.studentName : "Unnamed Student"),
                rollNo: item.rollNo || (existingMatch ? existingMatch.rollNo : String(100 + publishedCount)),
                class: cls.name || cls.label,
                className: cls.name || cls.label,
                section: cls.section || "A",
                classLabel: cls.label || `${cls.name}-${cls.section}`,
                subject: subject.name,
                examName: template.examName || template.name,
                templateName: template.name,
                templateId: template.id,
                examDate: (existingMatch && existingMatch.examDate) || new Date().toISOString().split("T")[0],
                correctionDate: new Date().toISOString().split("T")[0],
                maxMarks: template.maxMarks || 70,
                obtainedMarks: existingMatch ? existingMatch.obtainedMarks : 0,
                percentage: existingMatch ? existingMatch.percentage : 0,
                grade: existingMatch ? existingMatch.grade : "Pending",
                status: existingMatch ? existingMatch.status : "Pending",
                isUserUploaded: true,
                isMock: false,
                pdfDataUrl: item.pdfDataUrl || (existingMatch ? existingMatch.pdfDataUrl : null),
                pdfStorageUrl: item.file ? null : (existingMatch ? existingMatch.pdfStorageUrl : null),
                pageCount: item.pageCount || (existingMatch ? existingMatch.pageCount : 1),
                correctCount: existingMatch ? existingMatch.correctCount : 0,
                wrongCount: existingMatch ? existingMatch.wrongCount : 0,
                feedback: existingMatch ? existingMatch.feedback : "",
                // Save ONLY ONE: If it's a PDF, do not save duplicate pages array!
                pages: item.pdfDataUrl ? null : (item.pages && item.pages.length > 0 ? item.pages : null),
                annotations: existingMatch ? (existingMatch.annotations || []) : [],
                sections: (template.sections && template.sections.length > 0)
                    ? JSON.parse(JSON.stringify(template.sections))
                    : (window.MockData?.physicsTemplate?.sections ? JSON.parse(JSON.stringify(window.MockData.physicsTemplate.sections)) : []),
                questions: (existingMatch && existingMatch.questions && existingMatch.questions.length > 0) ? existingMatch.questions : questions,
                createdAt: (existingMatch && existingMatch.createdAt) || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            try {
                await window.appStorage.saveEvaluation(newEvaluation);
                publishedCount++;
            } catch (err) {
                console.error("Error saving evaluation:", err);
            }

            const finishPct = Math.round(((i + 1) / total) * 98);
            this.updatePublishDialogProgress(i + 1, total, finishPct, `✓ Saved paper ${i + 1} of ${total}: ${item.studentName}`);
        }

        this.setPublishDialogComplete(publishedCount);

        // Remove published items from active queue
        this.fileQueue = this.fileQueue.filter(item => !readyItems.includes(item));
        await this.loadExistingClassPapers();
        if (window.app && typeof window.app.updateStorageQuotaDisplay === "function") {
            window.app.updateStorageQuotaDisplay();
        }

        if (cls && subject) {
            sessionStorage.setItem("niprak_last_uploaded_class", cls.label || cls.name);
            sessionStorage.setItem("niprak_last_uploaded_subject", subject.name);
        }

        if (window.app && window.app.showToast) {
            window.app.showToast(`Published ${publishedCount} paper(s) to Teacher Evaluator Desk!`);
        }
    }

    // --- Load Existing Papers for Selected Class ---
    async loadExistingClassPapers() {
        const wrap = this.container.querySelector("#existing-papers-tbody-wrap");
        const countBadge = this.container.querySelector("#existing-count-badge");
        if (!wrap || !this.selectedClass || !this.selectedSubject || !this.selectedTemplate) return;

        const all = await window.appStorage.getAllEvaluations();
        const matches = all.filter(e =>
            (e.className === this.selectedClass.name || e.className === this.selectedClass.label) &&
            e.section === this.selectedClass.section &&
            e.subject === this.selectedSubject.name &&
            (e.templateId === this.selectedTemplate.id || e.examName === this.selectedTemplate.examName || e.templateName === this.selectedTemplate.name)
        );

        this.existingPapers = matches;
        if (countBadge) countBadge.textContent = `${matches.length} Paper(s) In Class`;

        if (matches.length === 0) {
            wrap.innerHTML = `
                <div class="empty-papers-notice">
                    <p>No papers uploaded yet for ${this.selectedClass.label} – ${this.selectedSubject.name} (${this.selectedTemplate.name}).</p>
                    <p class="empty-sub">Upload PDFs using the dropzone above or click "Quick Generate Sample PDF".</p>
                </div>
            `;
            return;
        }

        wrap.innerHTML = `
            <div class="table-wrapper">
                <table class="papers-table">
                    <thead>
                        <tr>
                            <th>Roll</th>
                            <th>Student Name</th>
                            <th>Pages</th>
                            <th>Status</th>
                            <th>Score</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${matches.map(p => `
                            <tr>
                                <td class="roll-cell">${p.rollNo}</td>
                                <td class="student-cell"><span class="student-name-text">${p.studentName}</span></td>
                                <td>${p.pageCount || p.pages?.length || 1} Pages</td>
                                <td>
                                    <span class="status-pill ${p.status === 'Completed' ? 'status-completed' : 'status-pending'}">
                                        ${p.status}
                                    </span>
                                </td>
                                <td>${p.status === 'Completed' ? `${p.obtainedMarks} / ${p.maxMarks}` : '—'}</td>
                                 <td style="display: flex; gap: 8px; align-items: center;">
                                    <button type="button" class="btn-action-view btn-portal-open-ws" data-id="${p.id}">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                        Evaluate
                                    </button>
                                    <button type="button" class="btn-action-delete btn-portal-delete-paper" data-id="${p.id}" title="Delete Uploaded Paper" style="background: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.3); color: #DC2626; padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        wrap.querySelectorAll(".btn-portal-open-ws").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                const pageDefault = document.body.getAttribute("data-default-portal");
                if (pageDefault === "uploader") {
                    localStorage.setItem("onespace_active_portal", "evaluator");
                    window.location.href = `teacher.html?evalId=${id}`;
                    return;
                }
                const ev = await window.appStorage.getEvaluationById(id);
                if (ev && this.options.onOpenWorkspace) {
                    this.options.onOpenWorkspace(ev);
                }
            });
        });

        wrap.querySelectorAll(".btn-portal-delete-paper").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const target = matches.find(p => String(p.id) === String(id));
                const name = target ? (target.studentName || "student paper") : "this paper";

                this.openCustomDeleteModal(
                    "Delete Uploaded Paper",
                    `Are you sure you want to delete ${name}'s uploaded paper? This will remove the paper and its evaluation record from the database.`,
                    async () => {
                        try {
                            btn.disabled = true;
                            btn.innerHTML = `<span style="font-size:0.75rem;">Deleting...</span>`;

                            if (window.appStorage) {
                                await window.appStorage.deleteEvaluation(id);
                            }
                            if (this.existingPapers) {
                                this.existingPapers = this.existingPapers.filter(p => String(p.id) !== String(id));
                            }
                            await this.loadExistingClassPapers();
                            if (window.app && window.app.showToast) {
                                window.app.showToast(`Deleted paper for ${name} successfully.`);
                            }
                        } catch (delErr) {
                            console.error("Error deleting paper:", delErr);
                            alert("Failed to delete paper: " + delErr.message);
                            await this.loadExistingClassPapers();
                        }
                    }
                );
            });
        });
    }
}

window.UploadPortalManager = UploadPortalManager;

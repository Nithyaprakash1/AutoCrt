/**
 * Niprak Digital Correction - Exam Template Data
 * Contains the Physics Board Examination Template (33 Qs / 70 Marks)
 * All institution, teacher, and class mock data removed.
 */

const MockData = {
    // Official Physics Board Paper Template (33 Qs / 70 Marks)
    physicsTemplate: {
        id: "phy-cbse-70",
        name: "Physics Board Paper (33 Qs / 70 Marks)",
        examName: "Annual Physics Board Assessment 2026",
        subject: "Physics",
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

    // Official English Core Board Paper Template (13 Qs / 80 Marks)
    englishTemplate: {
        id: "eng-core-cbse-80",
        name: "English Core Board Paper (13 Qs / 80 Marks)",
        examName: "Annual English Core Board Assessment 2026",
        subject: "English",
        maxMarks: 80,
        duration: "3 Hours",
        badge: "Official CBSE Blueprint",
        generalInstructions: [
            "This question paper contains 13 questions. All questions are compulsory.",
            "This question paper is divided into three sections – Section A (Reading Skills), Section B (Creative Writing Skills), and Section C (Literature).",
            "In Section A – Questions no. 1 and 2 are unseen passage-based reading comprehension questions. Question no. 1 carries 12 marks. Question no. 2 carries 10 marks.",
            "In Section B – Questions no. 3 to 6 are creative writing tasks. Internal choices are provided for all questions. Questions no. 3 and 4 are short writing tasks (Notice, Invitation/Reply) carrying 4 marks each. Questions no. 5 and 6 are long writing tasks (Letter Writing, Article/Report Writing) carrying 5 marks each.",
            "In Section C – Questions no. 7 to 13 are literature-based questions. Questions no. 7, 8, and 9 are extract-based questions carrying 6, 4, and 6 marks respectively. Questions no. 10 and 11 are short answer type questions carrying 2 marks each (Question no. 10: 5 out of 6 to be attempted; Question no. 11: 2 out of 3 to be attempted). Questions no. 12 and 13 are long answer type questions carrying 5 marks each."
        ],
        sections: [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A (Reading Skills – 22 Marks)",
                qStartNo: 1,
                qEndNo: 2,
                qCount: 2,
                maxMarks: 22,
                secTotal: 22,
                description: "Reading Skills"
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B (Creative Writing Skills – 18 Marks)",
                qStartNo: 3,
                qEndNo: 6,
                qCount: 4,
                maxMarks: 18,
                secTotal: 18,
                description: "Creative Writing Skills"
            },
            {
                id: "sec_c",
                letter: "C",
                name: "Section C",
                title: "Section C (Literature – 40 Marks)",
                qStartNo: 7,
                qEndNo: 13,
                qCount: 7,
                maxMarks: 40,
                secTotal: 40,
                description: "Literature"
            }
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
    },

    // Political Science Blueprint (Objective 40 MCQs + Subjective 40 Marks = 80 Marks Total)
    politicalScienceTemplate: {
        id: "pol-cbse-80",
        name: "Political Science (80 Marks: 40 MCQs + 40 Subjective)",
        examName: "Annual Political Science Assessment 2026",
        subject: "Political Science",
        maxMarks: 80,
        duration: "3 Hours",
        badge: "Official Blueprint",
        generalInstructions: [
            "This question paper consists of Objective (Part A) and Subjective (Part B) sections carrying 80 Marks total.",
            "Part A (Objective): Questions 1 to 40 are Multiple Choice Questions carrying 1 mark each.",
            "Part B (Subjective): Section I (Q41–Q44): 4 questions × 2 marks = 8 marks.",
            "Section II (Q45–Q47): 3 questions × 4 marks = 12 marks.",
            "Section III (Q48–Q49): 2 questions × 4 marks = 8 marks (Map / Cartoon / Passage-based).",
            "Section IV (Q50–Q51): 2 questions × 6 marks = 12 marks."
        ],
        sections: [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A - Objective MCQs (Q1 to Q40)",
                qStartNo: 1,
                qEndNo: 40,
                qCount: 40,
                marksPerQ: 1,
                maxMarks: 40,
                secTotal: 40,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B - Short Answer I (4 × 2 = 8 Marks)",
                qStartNo: 41,
                qEndNo: 44,
                qCount: 4,
                marksPerQ: 2,
                maxMarks: 8,
                secTotal: 8,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_c",
                letter: "C",
                name: "Section C",
                title: "Section C - Short Answer II (3 × 4 = 12 Marks)",
                qStartNo: 45,
                qEndNo: 47,
                qCount: 3,
                marksPerQ: 4,
                maxMarks: 12,
                secTotal: 12,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_d",
                letter: "D",
                name: "Section D",
                title: "Section D - Map / Cartoon / Passage (2 × 4 = 8 Marks)",
                qStartNo: 48,
                qEndNo: 49,
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
                title: "Section E - Long Answer (2 × 6 = 12 Marks)",
                qStartNo: 50,
                qEndNo: 51,
                qCount: 2,
                marksPerQ: 6,
                maxMarks: 12,
                secTotal: 12,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            }
        ],
        questions: (function() {
            const qs = [];
            // Section A: 40 MCQs (Q1 to Q40)
            for (let i = 1; i <= 40; i++) {
                qs.push({
                    id: `pol_q${i}`,
                    qNo: i,
                    qNumber: `Q${i}`,
                    label: `Q${i}`,
                    maxMarks: 1,
                    section: "Section A",
                    sectionId: "sec_a",
                    topic: `Objective MCQ ${i}`
                });
            }
            // Section B: 4 Short Answer (4x2 = 8M) (Q41 to Q44)
            for (let i = 1; i <= 4; i++) {
                const qNum = 40 + i;
                qs.push({
                    id: `pol_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 2,
                    section: "Section B",
                    sectionId: "sec_b",
                    topic: `Short Answer (2 Marks)`
                });
            }
            // Section C: 3 Short Answer (3x4 = 12M) (Q45 to Q47)
            for (let i = 1; i <= 3; i++) {
                const qNum = 44 + i;
                qs.push({
                    id: `pol_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 4,
                    section: "Section C",
                    sectionId: "sec_c",
                    topic: `Short Answer (4 Marks)`
                });
            }
            // Section D: 2 Map/Cartoon/Passage (2x4 = 8M) (Q48 & Q49)
            qs.push({
                id: "pol_q48",
                qNo: 48,
                qNumber: "Q48",
                label: "Q48",
                maxMarks: 4,
                section: "Section D",
                sectionId: "sec_d",
                topic: "Map / Cartoon / Passage-based (4 Marks)"
            });
            qs.push({
                id: "pol_q49",
                qNo: 49,
                qNumber: "Q49",
                label: "Q49",
                maxMarks: 4,
                section: "Section D",
                sectionId: "sec_d",
                topic: "Map / Cartoon / Passage-based (4 Marks)"
            });
            // Section E: 2 Long Answer (2x6 = 12M) (Q50 & Q51)
            qs.push({
                id: "pol_q50",
                qNo: 50,
                qNumber: "Q50",
                label: "Q50",
                maxMarks: 6,
                section: "Section E",
                sectionId: "sec_e",
                topic: "Long Answer (6 Marks)"
            });
            qs.push({
                id: "pol_q51",
                qNo: 51,
                qNumber: "Q51",
                label: "Q51",
                maxMarks: 6,
                section: "Section E",
                sectionId: "sec_e",
                topic: "Long Answer (6 Marks)"
            });
            return qs;
        })()
    },

    // Economics Blueprint (Objective 40 MCQs + Subjective 40 Marks = 80 Marks Total)
    economicsTemplate: {
        id: "eco-cbse-80",
        name: "Economics (80 Marks: 40 MCQs + 40 Subjective)",
        examName: "Annual Economics Assessment 2026",
        subject: "Economics",
        maxMarks: 80,
        duration: "3 Hours",
        badge: "Official Blueprint",
        generalInstructions: [
            "This question paper consists of Objective (Part A) and Subjective (Part B) sections carrying 80 Marks total.",
            "Part A (Objective): Questions 1 to 40 are Multiple Choice Questions carrying 1 mark each.",
            "Part B (Subjective): Section I (Q41–Q44): 4 questions × 3 marks = 12 marks.",
            "Section II (Q45–Q48): 4 questions × 4 marks = 16 marks.",
            "Section III (Q49–Q50): 2 questions × 6 marks = 12 marks."
        ],
        sections: [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A - Objective MCQs (Q1 to Q40)",
                qStartNo: 1,
                qEndNo: 40,
                qCount: 40,
                marksPerQ: 1,
                maxMarks: 40,
                secTotal: 40,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B - Short Answer I (4 × 3 = 12 Marks)",
                qStartNo: 41,
                qEndNo: 44,
                qCount: 4,
                marksPerQ: 3,
                maxMarks: 12,
                secTotal: 12,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_c",
                letter: "C",
                name: "Section C",
                title: "Section C - Short Answer II (4 × 4 = 16 Marks)",
                qStartNo: 45,
                qEndNo: 48,
                qCount: 4,
                marksPerQ: 4,
                maxMarks: 16,
                secTotal: 16,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_d",
                letter: "D",
                name: "Section D",
                title: "Section D - Long Answer (2 × 6 = 12 Marks)",
                qStartNo: 49,
                qEndNo: 50,
                qCount: 2,
                marksPerQ: 6,
                maxMarks: 12,
                secTotal: 12,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            }
        ],
        questions: (function() {
            const qs = [];
            // Section A: 40 MCQs (Q1 to Q40)
            for (let i = 1; i <= 40; i++) {
                qs.push({
                    id: `eco_q${i}`,
                    qNo: i,
                    qNumber: `Q${i}`,
                    label: `Q${i}`,
                    maxMarks: 1,
                    section: "Section A",
                    sectionId: "sec_a",
                    topic: `Objective MCQ ${i}`
                });
            }
            // Section B: 4 Short Answer (4x3 = 12M) (Q41 to Q44)
            for (let i = 1; i <= 4; i++) {
                const qNum = 40 + i;
                qs.push({
                    id: `eco_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 3,
                    section: "Section B",
                    sectionId: "sec_b",
                    topic: `Short Answer (3 Marks)`
                });
            }
            // Section C: 4 Short Answer (4x4 = 16M) (Q45 to Q48)
            for (let i = 1; i <= 4; i++) {
                const qNum = 44 + i;
                qs.push({
                    id: `eco_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 4,
                    section: "Section C",
                    sectionId: "sec_c",
                    topic: `Short Answer (4 Marks)`
                });
            }
            // Section D: 2 Long Answer (2x6 = 12M) (Q49 & Q50)
            qs.push({
                id: "eco_q49",
                qNo: 49,
                qNumber: "Q49",
                label: "Q49",
                maxMarks: 6,
                section: "Section D",
                sectionId: "sec_d",
                topic: "Long Answer (6 Marks)"
            });
            qs.push({
                id: "eco_q50",
                qNo: 50,
                qNumber: "Q50",
                label: "Q50",
                maxMarks: 6,
                section: "Section D",
                sectionId: "sec_d",
                topic: "Long Answer (6 Marks)"
            });
            return qs;
        })()
    },

    // Grade 12 Physics Revision 1 Blueprint (Objective 40x1=40 + Subjective 40 = 80 Marks Total)
    physicsRevision1Template: {
        id: "phy-rev1-80",
        name: "Grade 12 Physics Revision 1 (80 Marks)",
        examName: "Grade 12 Physics Revision 1 Assessment 2026",
        subject: "Physics",
        maxMarks: 80,
        duration: "3 Hours",
        badge: "Revision 1 Blueprint",
        generalInstructions: [
            "This question paper consists of Objective (40 MCQs) and Subjective (40 Marks) sections carrying 80 Marks total.",
            "Objectives: 40 MCQs × 1 = 40 Marks (Q1 to Q40).",
            "Subjective Section I: 5 questions × 2 marks = 10 Marks (Q41 to Q45).",
            "Subjective Section II: 4 questions × 3 marks = 12 Marks (Q46 to Q49).",
            "Subjective Section III: 2 questions × 5 marks = 10 Marks (Q50 to Q51).",
            "Subjective Section IV: Case Study 2 questions × 4 marks = 8 Marks (Q52 to Q53)."
        ],
        sections: [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A - Revision 1 Objectives (MCQ 40 × 1 = 40)",
                qStartNo: 1,
                qEndNo: 40,
                qCount: 40,
                marksPerQ: 1,
                maxMarks: 40,
                secTotal: 40,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B - Subjective I (5 × 2 = 10 Marks)",
                qStartNo: 41,
                qEndNo: 45,
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
                title: "Section C - Subjective II (4 × 3 = 12 Marks)",
                qStartNo: 46,
                qEndNo: 49,
                qCount: 4,
                marksPerQ: 3,
                maxMarks: 12,
                secTotal: 12,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_d",
                letter: "D",
                name: "Section D",
                title: "Section D - Subjective III (2 × 5 = 10 Marks)",
                qStartNo: 50,
                qEndNo: 51,
                qCount: 2,
                marksPerQ: 5,
                maxMarks: 10,
                secTotal: 10,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_e",
                letter: "E",
                name: "Section E",
                title: "Section E - Subjective IV Case Study (2 × 4 = 8 Marks)",
                qStartNo: 52,
                qEndNo: 53,
                qCount: 2,
                marksPerQ: 4,
                maxMarks: 8,
                secTotal: 8,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            }
        ],
        questions: (function() {
            const qs = [];
            // Section A: 40 MCQs (Q1 to Q40)
            for (let i = 1; i <= 40; i++) {
                qs.push({
                    id: `phy_rev1_q${i}`,
                    qNo: i,
                    qNumber: `Q${i}`,
                    label: `Q${i}`,
                    maxMarks: 1,
                    section: "Section A",
                    sectionId: "sec_a",
                    topic: `Physics MCQ ${i}`
                });
            }
            // Section B: Subjective I (5 x 2 = 10M) (Q41 to Q45)
            for (let i = 1; i <= 5; i++) {
                const qNum = 40 + i;
                qs.push({
                    id: `phy_rev1_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 2,
                    section: "Section B",
                    sectionId: "sec_b",
                    topic: `Subjective 2 Marks Question`
                });
            }
            // Section C: Subjective II (4 x 3 = 12M) (Q46 to Q49)
            for (let i = 1; i <= 4; i++) {
                const qNum = 45 + i;
                qs.push({
                    id: `phy_rev1_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 3,
                    section: "Section C",
                    sectionId: "sec_c",
                    topic: `Subjective 3 Marks Question`
                });
            }
            // Section D: Subjective III (2 x 5 = 10M) (Q50 to Q51)
            for (let i = 1; i <= 2; i++) {
                const qNum = 49 + i;
                qs.push({
                    id: `phy_rev1_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 5,
                    section: "Section D",
                    sectionId: "sec_d",
                    topic: `Subjective 5 Marks Question`
                });
            }
            // Section E: Subjective IV Case study (2 x 4 = 8M) (Q52 to Q53)
            for (let i = 1; i <= 2; i++) {
                const qNum = 51 + i;
                qs.push({
                    id: `phy_rev1_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 4,
                    section: "Section E",
                    sectionId: "sec_e",
                    topic: `Case Study 4 Marks Question`
                });
            }
            return qs;
        })()
    },

    // Grade 12 History Revision 1 Blueprint (Objective 40x1=40 + Subjective 40 = 80 Marks Total)
    historyRevision1Template: {
        id: "his-rev1-80",
        name: "Grade 12 History Revision 1 (80 Marks)",
        examName: "Grade 12 History Revision 1 Assessment 2026",
        subject: "History",
        maxMarks: 80,
        duration: "3 Hours",
        badge: "Revision 1 Blueprint",
        generalInstructions: [
            "This question paper consists of Objective (40 MCQs) and Subjective (40 Marks) sections carrying 80 Marks total.",
            "Revision 1 - Objectives: 40 MCQs × 1 = 40 Marks (Q1 to Q40).",
            "Subjective Section I: 3 marks × 5 = 15 Marks (Q41 to Q45).",
            "Subjective Section II: 8 marks × 2 = 16 Marks (Q46 to Q47).",
            "Subjective Section III: Case study 3 marks × 3 = 9 Marks (Q48 to Q50)."
        ],
        sections: [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A - Revision 1 Objectives (MCQ 40 × 1 = 40)",
                qStartNo: 1,
                qEndNo: 40,
                qCount: 40,
                marksPerQ: 1,
                maxMarks: 40,
                secTotal: 40,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B - Subjective I (3 Marks × 5 = 15 Marks)",
                qStartNo: 41,
                qEndNo: 45,
                qCount: 5,
                marksPerQ: 3,
                maxMarks: 15,
                secTotal: 15,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_c",
                letter: "C",
                name: "Section C",
                title: "Section C - Subjective II (8 Marks × 2 = 16 Marks)",
                qStartNo: 46,
                qEndNo: 47,
                qCount: 2,
                marksPerQ: 8,
                maxMarks: 16,
                secTotal: 16,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_d",
                letter: "D",
                name: "Section D",
                title: "Section D - Subjective III Case Study (3 Marks × 3 = 9 Marks)",
                qStartNo: 48,
                qEndNo: 50,
                qCount: 3,
                marksPerQ: 3,
                maxMarks: 9,
                secTotal: 9,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            }
        ],
        questions: (function() {
            const qs = [];
            // Section A: 40 MCQs (Q1 to Q40)
            for (let i = 1; i <= 40; i++) {
                qs.push({
                    id: `his_rev1_q${i}`,
                    qNo: i,
                    qNumber: `Q${i}`,
                    label: `Q${i}`,
                    maxMarks: 1,
                    section: "Section A",
                    sectionId: "sec_a",
                    topic: `History MCQ ${i}`
                });
            }
            // Section B: 3 marks x 5 = 15 Marks (Q41 to Q45)
            for (let i = 1; i <= 5; i++) {
                const qNum = 40 + i;
                qs.push({
                    id: `his_rev1_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 3,
                    section: "Section B",
                    sectionId: "sec_b",
                    topic: `Short Answer Question (${qNum})`
                });
            }
            // Section C: 8 marks x 2 = 16 Marks (Q46 to Q47)
            for (let i = 1; i <= 2; i++) {
                const qNum = 45 + i;
                qs.push({
                    id: `his_rev1_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 8,
                    section: "Section C",
                    sectionId: "sec_c",
                    topic: `Long Answer Essay Question (${qNum})`
                });
            }
            // Section D: Case study 3 marks x 3 = 9 Marks (Q48 to Q50)
            for (let i = 1; i <= 3; i++) {
                const qNum = 47 + i;
                qs.push({
                    id: `his_rev1_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 3,
                    section: "Section D",
                    sectionId: "sec_d",
                    topic: `Case Study Source Analysis (${qNum})`
                });
            }
            return qs;
        })()
    },

    // GRADE XII ENGLISH (Objective 40 + Subjective 40 = 80 Marks Total)
    englishGrade12ObjSubjTemplate: {
        id: "eng-xii-rev-80",
        name: "Grade XII English (80 Marks: 40 Objective + 40 Subjective)",
        examName: "Grade XII English Assessment 2026",
        subject: "English",
        maxMarks: 80,
        duration: "3 Hours",
        badge: "Official Blueprint",
        generalInstructions: [
            "This question paper consists of Objective (40 Marks) and Subjective (40 Marks) sections carrying 80 Marks total.",
            "Objective: MCQs and Fill ups - 40 marks (Q1 to Q40).",
            "Subjective Section I: One Mark Fill Ups - 10 questions × 1 mark = 10 Marks (Q41 to Q50).",
            "Subjective Section II: 2 Marks × 5 = 10 Marks (Q51 to Q55).",
            "Subjective Section III: 5 Marks × 4 = 20 Marks (Q56 to Q59)."
        ],
        sections: [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A - Objective (MCQs & Fill ups – 40 Marks)",
                qStartNo: 1,
                qEndNo: 40,
                qCount: 40,
                marksPerQ: 1,
                maxMarks: 40,
                secTotal: 40,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B - Subjective One Mark Fill Ups (10 × 1 = 10 Marks)",
                qStartNo: 41,
                qEndNo: 50,
                qCount: 10,
                marksPerQ: 1,
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
                title: "Section C - Subjective Short Answer (2 Marks × 5 = 10 Marks)",
                qStartNo: 51,
                qEndNo: 55,
                qCount: 5,
                marksPerQ: 2,
                maxMarks: 10,
                secTotal: 10,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_d",
                letter: "D",
                name: "Section D",
                title: "Section D - Subjective Long Answer (5 Marks × 4 = 20 Marks)",
                qStartNo: 56,
                qEndNo: 59,
                qCount: 4,
                marksPerQ: 5,
                maxMarks: 20,
                secTotal: 20,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            }
        ],
        questions: (function() {
            const qs = [];
            // Section A: MCQs and Fill ups (40 Marks, Q1 to Q40)
            for (let i = 1; i <= 40; i++) {
                qs.push({
                    id: `eng_xii_q${i}`,
                    qNo: i,
                    qNumber: `Q${i}`,
                    label: `Q${i}`,
                    maxMarks: 1,
                    section: "Section A",
                    sectionId: "sec_a",
                    topic: `Objective MCQ / Fill up ${i}`
                });
            }
            // Section B: One Mark Fill Ups (10 Marks, Q41 to Q50)
            for (let i = 1; i <= 10; i++) {
                const qNum = 40 + i;
                qs.push({
                    id: `eng_xii_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 1,
                    section: "Section B",
                    sectionId: "sec_b",
                    topic: `Subjective Fill up (${qNum})`
                });
            }
            // Section C: 2 Marks 2x5=10 (Q51 to Q55)
            for (let i = 1; i <= 5; i++) {
                const qNum = 50 + i;
                qs.push({
                    id: `eng_xii_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 2,
                    section: "Section C",
                    sectionId: "sec_c",
                    topic: `Short Answer (2 Marks)`
                });
            }
            // Section D: 5 Marks 5x4=20 (Q56 to Q59)
            for (let i = 1; i <= 4; i++) {
                const qNum = 55 + i;
                qs.push({
                    id: `eng_xii_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 5,
                    section: "Section D",
                    sectionId: "sec_d",
                    topic: `Long Answer / Composition (5 Marks)`
                });
            }
            return qs;
        })()
    },

    // Grade X Social Revision 1 Blueprint (Objective 40x1=40 + Subjective 40 = 80 Marks Total)
    socialGrade10Revision1Template: {
        id: "soc-x-rev1-80",
        name: "Grade X Social Revision 1 (80 Marks)",
        examName: "Grade X Social Science Revision 1 Assessment 2026",
        subject: "Social Science",
        maxMarks: 80,
        duration: "3 Hours",
        badge: "Revision 1 Blueprint",
        generalInstructions: [
            "This question paper consists of Objective (40 MCQs) and Subjective (40 Marks) sections carrying 80 Marks total.",
            "Revision 1 - Objectives: 40 MCQs × 1 = 40 Marks (Q1 to Q40).",
            "Subjective Section I: 2 marks × 3 = 6 Marks (Q41 to Q43).",
            "Subjective Section II: 3 marks × 5 = 15 Marks (Q44 to Q48).",
            "Subjective Section III: 5 marks × 3 = 15 Marks (Q49 to Q51).",
            "Subjective Section IV: Case study 4 marks 1 × 4 = 4 Marks (Q52)."
        ],
        sections: [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A - Revision 1 Objectives (MCQ 40 × 1 = 40)",
                qStartNo: 1,
                qEndNo: 40,
                qCount: 40,
                marksPerQ: 1,
                maxMarks: 40,
                secTotal: 40,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B - Subjective I (2 Marks × 3 = 6 Marks)",
                qStartNo: 41,
                qEndNo: 43,
                qCount: 3,
                marksPerQ: 2,
                maxMarks: 6,
                secTotal: 6,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_c",
                letter: "C",
                name: "Section C",
                title: "Section C - Subjective II (3 Marks × 5 = 15 Marks)",
                qStartNo: 44,
                qEndNo: 48,
                qCount: 5,
                marksPerQ: 3,
                maxMarks: 15,
                secTotal: 15,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_d",
                letter: "D",
                name: "Section D",
                title: "Section D - Subjective III (5 Marks × 3 = 15 Marks)",
                qStartNo: 49,
                qEndNo: 51,
                qCount: 3,
                marksPerQ: 5,
                maxMarks: 15,
                secTotal: 15,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_e",
                letter: "E",
                name: "Section E",
                title: "Section E - Subjective IV Case Study (4 Marks × 1 = 4 Marks)",
                qStartNo: 52,
                qEndNo: 52,
                qCount: 1,
                marksPerQ: 4,
                maxMarks: 4,
                secTotal: 4,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            }
        ],
        questions: (function() {
            const qs = [];
            // Section A: 40 MCQs (Q1 to Q40)
            for (let i = 1; i <= 40; i++) {
                qs.push({
                    id: `soc_x_rev1_q${i}`,
                    qNo: i,
                    qNumber: `Q${i}`,
                    label: `Q${i}`,
                    maxMarks: 1,
                    section: "Section A",
                    sectionId: "sec_a",
                    topic: `Social Science MCQ ${i}`
                });
            }
            // Section B: 2 marks x 3 = 6 Marks (Q41 to Q43)
            for (let i = 1; i <= 3; i++) {
                const qNum = 40 + i;
                qs.push({
                    id: `soc_x_rev1_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 2,
                    section: "Section B",
                    sectionId: "sec_b",
                    topic: `Very Short Answer Question (${qNum})`
                });
            }
            // Section C: 3 marks x 5 = 15 Marks (Q44 to Q48)
            for (let i = 1; i <= 5; i++) {
                const qNum = 43 + i;
                qs.push({
                    id: `soc_x_rev1_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 3,
                    section: "Section C",
                    sectionId: "sec_c",
                    topic: `Short Answer Question (${qNum})`
                });
            }
            // Section D: 5 marks x 3 = 15 Marks (Q49 to Q51)
            for (let i = 1; i <= 3; i++) {
                const qNum = 48 + i;
                qs.push({
                    id: `soc_x_rev1_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 5,
                    section: "Section D",
                    sectionId: "sec_d",
                    topic: `Long Answer Question (${qNum})`
                });
            }
            // Section E: Case study 4 marks x 1 = 4 Marks (Q52)
            qs.push({
                id: `soc_x_rev1_q52`,
                qNo: 52,
                qNumber: "Q52",
                label: "Q52",
                maxMarks: 4,
                section: "Section E",
                sectionId: "sec_e",
                topic: `Case Study Source-Based Question (4 Marks)`
            });
            return qs;
        })()
    },

    // Grade 12 Entrepreneurship Blueprint (Objective 40 + Subjective 40 = 80 Marks Total)
    entrepreneurshipGrade12Template: {
        id: "ent-xii-80",
        name: "Grade 12 Entrepreneurship (80 Marks)",
        examName: "Grade 12 Entrepreneurship Assessment 2026",
        subject: "Entrepreneurship",
        maxMarks: 80,
        duration: "3 Hours",
        badge: "Official Blueprint",
        generalInstructions: [
            "This question paper consists of Objective (40 MCQs) and Subjective (40 Marks) sections carrying 80 Marks total.",
            "Objective: 40 MCQs × 1 = 40 Marks (Q1 to Q40).",
            "Subjective Section I: 5 questions × 2 marks = 10 Marks (Q41 to Q45).",
            "Subjective Section II: 5 questions × 3 marks = 15 Marks (Q46 to Q50).",
            "Subjective Section III: 3 questions × 5 marks = 15 Marks (Q51 to Q53)."
        ],
        sections: [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A - Objective MCQs (40 × 1 = 40 Marks)",
                qStartNo: 1,
                qEndNo: 40,
                qCount: 40,
                marksPerQ: 1,
                maxMarks: 40,
                secTotal: 40,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B - Subjective I (5 × 2 = 10 Marks)",
                qStartNo: 41,
                qEndNo: 45,
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
                title: "Section C - Subjective II (5 × 3 = 15 Marks)",
                qStartNo: 46,
                qEndNo: 50,
                qCount: 5,
                marksPerQ: 3,
                maxMarks: 15,
                secTotal: 15,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_d",
                letter: "D",
                name: "Section D",
                title: "Section D - Subjective III (3 × 5 = 15 Marks)",
                qStartNo: 51,
                qEndNo: 53,
                qCount: 3,
                marksPerQ: 5,
                maxMarks: 15,
                secTotal: 15,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            }
        ],
        questions: (function() {
            const qs = [];
            for (let i = 1; i <= 40; i++) {
                qs.push({
                    id: `ent_xii_q${i}`,
                    qNo: i,
                    qNumber: `Q${i}`,
                    label: `Q${i}`,
                    maxMarks: 1,
                    section: "Section A",
                    sectionId: "sec_a",
                    topic: `Entrepreneurship MCQ ${i}`
                });
            }
            for (let i = 1; i <= 5; i++) {
                const qNum = 40 + i;
                qs.push({
                    id: `ent_xii_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 2,
                    section: "Section B",
                    sectionId: "sec_b",
                    topic: `Short Answer (2 Marks)`
                });
            }
            for (let i = 1; i <= 5; i++) {
                const qNum = 45 + i;
                qs.push({
                    id: `ent_xii_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 3,
                    section: "Section C",
                    sectionId: "sec_c",
                    topic: `Short Answer (3 Marks)`
                });
            }
            for (let i = 1; i <= 3; i++) {
                const qNum = 50 + i;
                qs.push({
                    id: `ent_xii_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 5,
                    section: "Section D",
                    sectionId: "sec_d",
                    topic: `Long Answer (5 Marks)`
                });
            }
            return qs;
        })()
    },

    // Grade 12 Math Blueprint (Objective 40 + Subjective 40 = 80 Marks Total)
    mathGrade12Template: {
        id: "mat-xii-80",
        name: "Grade 12 Mathematics (80 Marks)",
        examName: "Grade 12 Mathematics Assessment 2026",
        subject: "Mathematics",
        maxMarks: 80,
        duration: "3 Hours",
        badge: "Official Blueprint",
        generalInstructions: [
            "This question paper consists of Objective (40 Marks) and Subjective (40 Marks) sections carrying 80 Marks total.",
            "Objective Section I: 28 MCQs × 1 mark = 28 Marks (Q1 to Q28).",
            "Objective Section II: 3 questions × 4 marks = 12 Marks (Q29 to Q31).",
            "Subjective Section I: 5 questions × 2 marks = 10 Marks (Q32 to Q36).",
            "Subjective Section II: 5 questions × 3 marks = 15 Marks (Q37 to Q41).",
            "Subjective Section III: 3 questions × 5 marks = 15 Marks (Q42 to Q44)."
        ],
        sections: [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A - Objective I (28 × 1 = 28 Marks)",
                qStartNo: 1,
                qEndNo: 28,
                qCount: 28,
                marksPerQ: 1,
                maxMarks: 28,
                secTotal: 28,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B - Objective II (3 × 4 = 12 Marks)",
                qStartNo: 29,
                qEndNo: 31,
                qCount: 3,
                marksPerQ: 4,
                maxMarks: 12,
                secTotal: 12,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_c",
                letter: "C",
                name: "Section C",
                title: "Section C - Subjective I (5 × 2 = 10 Marks)",
                qStartNo: 32,
                qEndNo: 36,
                qCount: 5,
                marksPerQ: 2,
                maxMarks: 10,
                secTotal: 10,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_d",
                letter: "D",
                name: "Section D",
                title: "Section D - Subjective II (5 × 3 = 15 Marks)",
                qStartNo: 37,
                qEndNo: 41,
                qCount: 5,
                marksPerQ: 3,
                maxMarks: 15,
                secTotal: 15,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_e",
                letter: "E",
                name: "Section E",
                title: "Section E - Subjective III (3 × 5 = 15 Marks)",
                qStartNo: 42,
                qEndNo: 44,
                qCount: 3,
                marksPerQ: 5,
                maxMarks: 15,
                secTotal: 15,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            }
        ],
        questions: (function() {
            const qs = [];
            // Section A: 28 x 1 = 28M (Q1 to Q28)
            for (let i = 1; i <= 28; i++) {
                qs.push({
                    id: `mat_xii_q${i}`,
                    qNo: i,
                    qNumber: `Q${i}`,
                    label: `Q${i}`,
                    maxMarks: 1,
                    section: "Section A",
                    sectionId: "sec_a",
                    topic: `Mathematics MCQ ${i}`
                });
            }
            // Section B: 3 x 4 = 12M (Q29 to Q31)
            for (let i = 1; i <= 3; i++) {
                const qNum = 28 + i;
                qs.push({
                    id: `mat_xii_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 4,
                    section: "Section B",
                    sectionId: "sec_b",
                    topic: `Case-based / Short Answer (4 Marks)`
                });
            }
            // Section C: 5 x 2 = 10M (Q32 to Q36)
            for (let i = 1; i <= 5; i++) {
                const qNum = 31 + i;
                qs.push({
                    id: `mat_xii_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 2,
                    section: "Section C",
                    sectionId: "sec_c",
                    topic: `Very Short Answer (2 Marks)`
                });
            }
            // Section D: 5 x 3 = 15M (Q37 to Q41)
            for (let i = 1; i <= 5; i++) {
                const qNum = 36 + i;
                qs.push({
                    id: `mat_xii_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 3,
                    section: "Section D",
                    sectionId: "sec_d",
                    topic: `Short Answer (3 Marks)`
                });
            }
            // Section E: 3 x 5 = 15M (Q42 to Q44)
            for (let i = 1; i <= 3; i++) {
                const qNum = 41 + i;
                qs.push({
                    id: `mat_xii_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 5,
                    section: "Section E",
                    sectionId: "sec_e",
                    topic: `Long Answer (5 Marks)`
                });
            }
            return qs;
        })()
    },

    // Grade 10 Math Blueprint (Objective MCQ & AR + Case Based + Subjective = 80 Marks Total)
    mathGrade10Template: {
        id: "mat-x-80",
        name: "Grade 10 Mathematics (80 Marks)",
        examName: "Grade 10 Mathematics Assessment 2026",
        subject: "Mathematics",
        maxMarks: 80,
        duration: "3 Hours",
        badge: "Official Blueprint",
        generalInstructions: [
            "This question paper consists of Objective (40 Marks) and Subjective (40 Marks) sections carrying 80 Marks total.",
            "Objective Section I: MCQ & AR 28 × 1 mark = 28 Marks (Q1 to Q28).",
            "Objective Section II: Case-based 3 × 4 marks = 12 Marks (Q29 to Q31).",
            "Subjective Section I: 5 questions × 2 marks = 10 Marks (Q32 to Q36).",
            "Subjective Section II: 5 questions × 3 marks = 15 Marks (Q37 to Q41).",
            "Subjective Section III: 3 questions × 5 marks = 15 Marks (Q42 to Q44)."
        ],
        sections: [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A - Objective I (MCQ & AR 28 × 1 = 28 Marks)",
                qStartNo: 1,
                qEndNo: 28,
                qCount: 28,
                marksPerQ: 1,
                maxMarks: 28,
                secTotal: 28,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B - Objective II (Case-based 3 × 4 = 12 Marks)",
                qStartNo: 29,
                qEndNo: 31,
                qCount: 3,
                marksPerQ: 4,
                maxMarks: 12,
                secTotal: 12,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_c",
                letter: "C",
                name: "Section C",
                title: "Section C - Subjective I (5 × 2 = 10 Marks)",
                qStartNo: 32,
                qEndNo: 36,
                qCount: 5,
                marksPerQ: 2,
                maxMarks: 10,
                secTotal: 10,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_d",
                letter: "D",
                name: "Section D",
                title: "Section D - Subjective II (5 × 3 = 15 Marks)",
                qStartNo: 37,
                qEndNo: 41,
                qCount: 5,
                marksPerQ: 3,
                maxMarks: 15,
                secTotal: 15,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_e",
                letter: "E",
                name: "Section E",
                title: "Section E - Subjective III (3 × 5 = 15 Marks)",
                qStartNo: 42,
                qEndNo: 44,
                qCount: 3,
                marksPerQ: 5,
                maxMarks: 15,
                secTotal: 15,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            }
        ],
        questions: (function() {
            const qs = [];
            // Section A: 28 x 1 = 28M (Q1 to Q28)
            for (let i = 1; i <= 28; i++) {
                qs.push({
                    id: `mat_x_q${i}`,
                    qNo: i,
                    qNumber: `Q${i}`,
                    label: `Q${i}`,
                    maxMarks: 1,
                    section: "Section A",
                    sectionId: "sec_a",
                    topic: `MCQ & Assertion-Reason ${i}`
                });
            }
            // Section B: Case based 3 x 4 = 12M (Q29 to Q31)
            for (let i = 1; i <= 3; i++) {
                const qNum = 28 + i;
                qs.push({
                    id: `mat_x_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 4,
                    section: "Section B",
                    sectionId: "sec_b",
                    topic: `Case-based Question (${qNum})`
                });
            }
            // Section C: 5 x 2 = 10M (Q32 to Q36)
            for (let i = 1; i <= 5; i++) {
                const qNum = 31 + i;
                qs.push({
                    id: `mat_x_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 2,
                    section: "Section C",
                    sectionId: "sec_c",
                    topic: `Very Short Answer (${qNum})`
                });
            }
            // Section D: 5 x 3 = 15M (Q37 to Q41)
            for (let i = 1; i <= 5; i++) {
                const qNum = 36 + i;
                qs.push({
                    id: `mat_x_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 3,
                    section: "Section D",
                    sectionId: "sec_d",
                    topic: `Short Answer (${qNum})`
                });
            }
            // Section E: 3 x 5 = 15M (Q42 to Q44)
            for (let i = 1; i <= 3; i++) {
                const qNum = 41 + i;
                qs.push({
                    id: `mat_x_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 5,
                    section: "Section E",
                    sectionId: "sec_e",
                    topic: `Long Answer (${qNum})`
                });
            }
            return qs;
        })()
    },

    // Grade 12 Revision Test 1 Blueprint (Mcq-1: 40x1=40 + Subjective Test 1: 5x2=10, 4x3=12, 2x4=8, 2x5=10 = 80 Marks Total)
    grade12RevisionTest1Template: {
        id: "g12-rev1-80",
        name: "Grade 12 Revision Test 1 (80 Marks)",
        examName: "Grade 12 Revision Test 1 Assessment 2026",
        subject: "Physics",
        maxMarks: 80,
        duration: "3 Hours",
        badge: "Revision 1 Blueprint",
        generalInstructions: [
            "This question paper consists of Mcq-1 (40 Marks) and Subjective Test 1 (40 Marks) carrying 80 Marks total.",
            "Mcq-1: 40 questions × 1 mark = 40 Marks (Q1 to Q40).",
            "Subjective Test 1 Section I: 5 questions × 2 marks = 10 Marks (Q41 to Q45).",
            "Subjective Test 1 Section II: 4 questions × 3 marks = 12 Marks (Q46 to Q49).",
            "Subjective Test 1 Section III: 2 questions × 4 marks = 8 Marks (Q50 to Q51).",
            "Subjective Test 1 Section IV: 2 questions × 5 marks = 10 Marks (Q52 to Q53)."
        ],
        sections: [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A - MCQ Test 1 (40 × 1 = 40 Marks)",
                qStartNo: 1,
                qEndNo: 40,
                qCount: 40,
                marksPerQ: 1,
                maxMarks: 40,
                secTotal: 40,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B - Subjective I (5 × 2 = 10 Marks)",
                qStartNo: 41,
                qEndNo: 45,
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
                title: "Section C - Subjective II (4 × 3 = 12 Marks)",
                qStartNo: 46,
                qEndNo: 49,
                qCount: 4,
                marksPerQ: 3,
                maxMarks: 12,
                secTotal: 12,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_d",
                letter: "D",
                name: "Section D",
                title: "Section D - Subjective III (2 × 4 = 8 Marks)",
                qStartNo: 50,
                qEndNo: 51,
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
                title: "Section E - Subjective IV (2 × 5 = 10 Marks)",
                qStartNo: 52,
                qEndNo: 53,
                qCount: 2,
                marksPerQ: 5,
                maxMarks: 10,
                secTotal: 10,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            }
        ],
        questions: (function() {
            const qs = [];
            // Section A: 40 MCQs (Q1 to Q40)
            for (let i = 1; i <= 40; i++) {
                qs.push({
                    id: `g12_rev1_q${i}`,
                    qNo: i,
                    qNumber: `Q${i}`,
                    label: `Q${i}`,
                    maxMarks: 1,
                    section: "Section A",
                    sectionId: "sec_a",
                    topic: `Objective MCQ ${i}`
                });
            }
            // Section B: 5 x 2 = 10M (Q41 to Q45)
            for (let i = 1; i <= 5; i++) {
                const qNum = 40 + i;
                qs.push({
                    id: `g12_rev1_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 2,
                    section: "Section B",
                    sectionId: "sec_b",
                    topic: `Very Short Answer (${qNum})`
                });
            }
            // Section C: 4 x 3 = 12M (Q46 to Q49)
            for (let i = 1; i <= 4; i++) {
                const qNum = 45 + i;
                qs.push({
                    id: `g12_rev1_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 3,
                    section: "Section C",
                    sectionId: "sec_c",
                    topic: `Short Answer (${qNum})`
                });
            }
            // Section D: 2 x 4 = 8M (Q50 to Q51)
            for (let i = 1; i <= 2; i++) {
                const qNum = 49 + i;
                qs.push({
                    id: `g12_rev1_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 4,
                    section: "Section D",
                    sectionId: "sec_d",
                    topic: `Case-based / Analytical (${qNum})`
                });
            }
            // Section E: 2 x 5 = 10M (Q52 to Q53)
            for (let i = 1; i <= 2; i++) {
                const qNum = 51 + i;
                qs.push({
                    id: `g12_rev1_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 5,
                    section: "Section E",
                    sectionId: "sec_e",
                    topic: `Long Answer (${qNum})`
                });
            }
            return qs;
        })()
    },

    // Grade 10 Science Biology Blueprint (MCQ 1: 15x1=15 + Subjective 1: 4x2=8, 1x3=3, 1x4=4 = 30 Marks Total)
    scienceGrade10BiologyTemplate: {
        id: "bio-x-30",
        name: "Grade 10 Biology (30 Marks)",
        examName: "Grade 10 Science Biology Assessment 2026",
        subject: "Biology",
        maxMarks: 30,
        duration: "1.5 Hours",
        badge: "Official Blueprint",
        generalInstructions: [
            "This question paper consists of MCQ-1 (15 Marks) and Subjective-1 (15 Marks) carrying 30 Marks total.",
            "MCQ 1: 15 questions × 1 mark = 15 Marks (Q1 to Q15).",
            "Subjective 1 Section I: 4 questions × 2 marks = 8 Marks (Q16 to Q19).",
            "Subjective 1 Section II: 1 question × 3 marks = 3 Marks (Q20).",
            "Subjective 1 Section III: 1 question × 4 marks = 4 Marks (Q21)."
        ],
        sections: [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A - MCQ 1 (15 × 1 = 15 Marks)",
                qStartNo: 1,
                qEndNo: 15,
                qCount: 15,
                marksPerQ: 1,
                maxMarks: 15,
                secTotal: 15,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B - Subjective I (4 × 2 = 8 Marks)",
                qStartNo: 16,
                qEndNo: 19,
                qCount: 4,
                marksPerQ: 2,
                maxMarks: 8,
                secTotal: 8,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_c",
                letter: "C",
                name: "Section C",
                title: "Section C - Subjective II (1 × 3 = 3 Marks)",
                qStartNo: 20,
                qEndNo: 20,
                qCount: 1,
                marksPerQ: 3,
                maxMarks: 3,
                secTotal: 3,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_d",
                letter: "D",
                name: "Section D",
                title: "Section D - Subjective III (1 × 4 = 4 Marks)",
                qStartNo: 21,
                qEndNo: 21,
                qCount: 1,
                marksPerQ: 4,
                maxMarks: 4,
                secTotal: 4,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            }
        ],
        questions: (function() {
            const qs = [];
            // Section A: 15 MCQs (Q1 to Q15)
            for (let i = 1; i <= 15; i++) {
                qs.push({
                    id: `bio_x_q${i}`,
                    qNo: i,
                    qNumber: `Q${i}`,
                    label: `Q${i}`,
                    maxMarks: 1,
                    section: "Section A",
                    sectionId: "sec_a",
                    topic: `Biology MCQ ${i}`
                });
            }
            // Section B: 4 x 2 = 8M (Q16 to Q19)
            for (let i = 1; i <= 4; i++) {
                const qNum = 15 + i;
                qs.push({
                    id: `bio_x_q${qNum}`,
                    qNo: qNum,
                    qNumber: `Q${qNum}`,
                    label: `Q${qNum}`,
                    maxMarks: 2,
                    section: "Section B",
                    sectionId: "sec_b",
                    topic: `Short Answer (2 Marks)`
                });
            }
            // Section C: 1 x 3 = 3M (Q20)
            qs.push({
                id: "bio_x_q20",
                qNo: 20,
                qNumber: "Q20",
                label: "Q20",
                maxMarks: 3,
                section: "Section C",
                sectionId: "sec_c",
                topic: "Short Answer (3 Marks)"
            });
            // Section D: 1 x 4 = 4M (Q21)
            qs.push({
                id: "bio_x_q21",
                qNo: 21,
                qNumber: "Q21",
                label: "Q21",
                maxMarks: 4,
                section: "Section D",
                sectionId: "sec_d",
                topic: "Case-based / Long Answer (4 Marks)"
            });
            return qs;
        })()
    },

    // Grade 10 Science Chemistry Blueprint (MCQ Test 1: 13x1=13 + Subjective Test 1: 1x2=2 [choice], 2x3=6, 1x5=5 [choice] = 26 Marks Total)
    scienceGrade10ChemistryTemplate: {
        id: "che-x-26",
        name: "Grade 10 Chemistry (26 Marks)",
        examName: "Grade 10 Science Chemistry Assessment 2026",
        subject: "Chemistry",
        maxMarks: 26,
        duration: "1.5 Hours",
        badge: "Official Blueprint",
        generalInstructions: [
            "This question paper consists of MCQ Test 1 (13 Marks) and Subjective Test 1 (13 Marks) carrying 26 Marks total.",
            "MCQ Test 1: 13 questions × 1 mark = 13 Marks (Q1 to Q13).",
            "Subjective Test 1 Section I: 1 question × 2 marks = 2 Marks with internal choice (Q14).",
            "Subjective Test 1 Section II: 2 questions × 3 marks = 6 Marks (Q15 & Q16).",
            "Subjective Test 1 Section III: 1 question × 5 marks = 5 Marks with internal choice (Q17)."
        ],
        sections: [
            {
                id: "sec_a",
                letter: "A",
                name: "Section A",
                title: "Section A - MCQ Test 1 (13 × 1 = 13 Marks)",
                qStartNo: 1,
                qEndNo: 13,
                qCount: 13,
                marksPerQ: 1,
                maxMarks: 13,
                secTotal: 13,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_b",
                letter: "B",
                name: "Section B",
                title: "Section B - Subjective I (1 × 2 = 2 Marks with choice)",
                qStartNo: 14,
                qEndNo: 14,
                qCount: 1,
                marksPerQ: 2,
                maxMarks: 2,
                secTotal: 2,
                hasChoice: true,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_c",
                letter: "C",
                name: "Section C",
                title: "Section C - Subjective II (2 × 3 = 6 Marks)",
                qStartNo: 15,
                qEndNo: 16,
                qCount: 2,
                marksPerQ: 3,
                maxMarks: 6,
                secTotal: 6,
                hasChoice: false,
                hasSubQuestions: false,
                subQuestions: []
            },
            {
                id: "sec_d",
                letter: "D",
                name: "Section D",
                title: "Section D - Subjective III (1 × 5 = 5 Marks with choice)",
                qStartNo: 17,
                qEndNo: 17,
                qCount: 1,
                marksPerQ: 5,
                maxMarks: 5,
                secTotal: 5,
                hasChoice: true,
                hasSubQuestions: false,
                subQuestions: []
            }
        ],
        questions: (function() {
            const qs = [];
            // Section A: 13 MCQs (Q1 to Q13)
            for (let i = 1; i <= 13; i++) {
                qs.push({
                    id: `che_x_q${i}`,
                    qNo: i,
                    qNumber: `Q${i}`,
                    label: `Q${i}`,
                    maxMarks: 1,
                    section: "Section A",
                    sectionId: "sec_a",
                    topic: `Chemistry MCQ ${i}`
                });
            }
            // Section B: Q14 (1 x 2 = 2M with internal choice)
            qs.push({
                id: "che_x_q14",
                qNo: 14,
                qNumber: "Q14",
                label: "Q14",
                maxMarks: 2,
                section: "Section B",
                sectionId: "sec_b",
                topic: "Short Answer (2 Marks - With Internal Choice)",
                isChoice: true,
                choices: ["Question 14 (Option A)", "Question 14 (Option B)"]
            });
            // Section C: Q15 & Q16 (2 x 3 = 6M)
            qs.push({
                id: "che_x_q15",
                qNo: 15,
                qNumber: "Q15",
                label: "Q15",
                maxMarks: 3,
                section: "Section C",
                sectionId: "sec_c",
                topic: "Short Answer (3 Marks)"
            });
            qs.push({
                id: "che_x_q16",
                qNo: 16,
                qNumber: "Q16",
                label: "Q16",
                maxMarks: 3,
                section: "Section C",
                sectionId: "sec_c",
                topic: "Short Answer (3 Marks)"
            });
            // Section D: Q17 (1 x 5 = 5M with internal choice)
            qs.push({
                id: "che_x_q17",
                qNo: 17,
                qNumber: "Q17",
                label: "Q17",
                maxMarks: 5,
                section: "Section D",
                sectionId: "sec_d",
                topic: "Long Answer (5 Marks - With Internal Choice)",
                isChoice: true,
                choices: ["Question 17 (Option A)", "Question 17 (Option B)"]
            });
            return qs;
        })()
    },

    presetComments: [
        "Good presentation",
        "Step derivation complete",
        "Unit missing in final answer",
        "Check calculation in formula",
        "Ray direction arrow missing in diagram",
        "Excellent solution"
    ],

    /**
     * Returns empty array — no mock sample pages generated.
     */
    generateSamplePaperPages: function(studentName = "Student", regNo = "001") {
        return [];
    },

    /**
     * Returns empty evaluation list — no dummy mock evaluations.
     */
    getInitialEvaluations: function() {
        return [];
    }
};

window.MockData = MockData;

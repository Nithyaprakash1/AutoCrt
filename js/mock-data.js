/**
 * OneSpace Digital Correction - Exam Template Data
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

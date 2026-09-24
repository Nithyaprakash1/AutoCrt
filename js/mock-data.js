/**
 * OneSpace Digital Correction - Clean Data Layer & Physics Template
 * Contains only the Physics Board Examination Template (33 Qs / 70 Marks)
 * ready for Firestore deployment, with all dummy evaluation mock data removed.
 */

const MockData = {
    institution: {
        id: "inst_01",
        name: "Adwaith Thought Academy",
        code: "ATA-2026",
        address: "742 Evergreen Terrace, Tech Park City",
        phone: "+91 98765 43210",
        email: "evaluation@adwaith.edu",
        logoText: "OneSpace OSM",
        logo: "assets/school_logo.jpg",
        fullLogo: "assets/school_fulllogo.jpg"
    },

    teacher: {
        id: "teacher_01",
        name: "Mrs. Nithya Prakash",
        designation: "Senior Physics & Mathematics Faculty",
        department: "Physics & Science Department",
        academicYear: "2026-2027"
    },

    classes: [
        { id: "12-A", name: "Class 12", section: "A", label: "Class 12-A", stream: "Physics & Mathematics" },
        { id: "12-B", name: "Class 12", section: "B", label: "Class 12-B", stream: "Physics & Biology" }
    ],

    subjects: ["Physics"],

    // Official Physics Board Paper Template (33 Qs / 70 Marks) - Ready for Firestore
    physicsTemplate: {
        id: "phy-cbse-70",
        name: "Physics Board Paper (33 Qs / 70 Marks)",
        examName: "Annual Physics Board Assessment 2026",
        subject: "Physics",
        maxMarks: 70,
        duration: "3 Hours",
        badge: "Official Blueprint",
        questions: [
            { qNumber: "Q1", maxMarks: 1, section: "Section A", topic: "Electric Charges & Fields (MCQ)" },
            { qNumber: "Q2", maxMarks: 1, section: "Section A", topic: "Electrostatic Potential (MCQ)" },
            { qNumber: "Q3", maxMarks: 1, section: "Section A", topic: "Current Electricity & Ohm's Law (MCQ)" },
            { qNumber: "Q4", maxMarks: 1, section: "Section A", topic: "Moving Charges & Magnetism (MCQ)" },
            { qNumber: "Q5", maxMarks: 1, section: "Section A", topic: "Magnetism and Matter (MCQ)" },
            { qNumber: "Q6", maxMarks: 1, section: "Section A", topic: "Electromagnetic Induction (MCQ)" },
            { qNumber: "Q7", maxMarks: 1, section: "Section A", topic: "Alternating Current & Resonance (MCQ)" },
            { qNumber: "Q8", maxMarks: 1, section: "Section A", topic: "Electromagnetic Waves (MCQ)" },
            { qNumber: "Q9", maxMarks: 1, section: "Section A", topic: "Ray Optics & Prism (MCQ)" },
            { qNumber: "Q10", maxMarks: 1, section: "Section A", topic: "Wave Optics & Interference (MCQ)" },
            { qNumber: "Q11", maxMarks: 1, section: "Section A", topic: "Dual Nature of Radiation (MCQ)" },
            { qNumber: "Q12", maxMarks: 1, section: "Section A", topic: "Atoms & Bohr Model (MCQ)" },
            { qNumber: "Q13", maxMarks: 1, section: "Section A", topic: "Nuclei & Radioactivity (MCQ)" },
            { qNumber: "Q14", maxMarks: 1, section: "Section A", topic: "Semiconductor Electronics (MCQ)" },
            { qNumber: "Q15", maxMarks: 1, section: "Section A", topic: "Assertion-Reason: Electrostatics" },
            { qNumber: "Q16", maxMarks: 1, section: "Section A", topic: "Assertion-Reason: Optics" },
            { qNumber: "Q17", maxMarks: 2, section: "Section B", topic: "Electric Dipole Torque & Field (VSA)" },
            { qNumber: "Q18", maxMarks: 2, section: "Section B", topic: "Drift Velocity & Resistance (VSA)" },
            { qNumber: "Q19", maxMarks: 2, section: "Section B", topic: "Self & Mutual Inductance (VSA)" },
            { qNumber: "Q20", maxMarks: 2, section: "Section B", topic: "De Broglie Wavelength Calculation (VSA)" },
            { qNumber: "Q21", maxMarks: 2, section: "Section B", topic: "p-n Junction Diode Characteristics (VSA)" },
            { qNumber: "Q22", maxMarks: 3, section: "Section C", topic: "Gauss's Law & Spherical Shell (SA)" },
            { qNumber: "Q23", maxMarks: 3, section: "Section C", topic: "Wheatstone Bridge & Kirchhoff's Rules (SA)" },
            { qNumber: "Q24", maxMarks: 3, section: "Section C", topic: "Biot-Savart Law & Circular Loop (SA)" },
            { qNumber: "Q25", maxMarks: 3, section: "Section C", topic: "Transformer Principle & Efficiency (SA)" },
            { qNumber: "Q26", maxMarks: 3, section: "Section C", topic: "Lens Maker's Formula Derivation (SA)" },
            { qNumber: "Q27", maxMarks: 3, section: "Section C", topic: "Young's Double Slit Experiment (SA)" },
            { qNumber: "Q28", maxMarks: 3, section: "Section C", topic: "Photoelectric Effect & Einstein's Equation (SA)" },
            { qNumber: "Q29", maxMarks: 4, section: "Section D", topic: "Case Study 1: Total Internal Reflection & Optical Fibres" },
            { qNumber: "Q30", maxMarks: 4, section: "Section D", topic: "Case Study 2: Solar Cell & Semiconductor Photodiodes" },
            { qNumber: "Q31", maxMarks: 5, section: "Section E", topic: "Parallel Plate Capacitor & Dielectric Slab (LA)" },
            { qNumber: "Q32", maxMarks: 5, section: "Section E", topic: "AC Generator Derivation & Phasor Diagrams (LA)" },
            { qNumber: "Q33", maxMarks: 5, section: "Section E", topic: "Astronomical Telescope Derivation & Ray Diagram (LA)" }
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
     * Disabled: No mock sample paper generation. Returns empty array.
     */
    generateSamplePaperPages: function(studentName = "Physics Student", regNo = "101") {
        return [];
    },

    /**
     * Returns empty evaluation list by default (no dummy mock evaluations)
     */
    getInitialEvaluations: function() {
        return [];
    }
};

window.MockData = MockData;

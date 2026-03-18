import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

import connectDB from './src/config/db.js';
import User from './src/models/User.js';
import JobDescription from './src/models/JobDescription.js';
import { ROLES } from './src/utils/roles.js';
import { USER_STATUSES } from './src/utils/userStatus.js';

dotenv.config();

const SALT_ROUNDS = 10;

const USERS = [
    {
        name: 'System Admin',
        email: 'admin@resumeai.com',
        password: 'Admin@123',
        role: ROLES.ADMIN,
        status: USER_STATUSES.ACTIVE
    },
    {
        name: 'Aarav Candidate',
        email: 'candidate1@resumeai.com',
        password: 'Candidate@123',
        role: ROLES.CANDIDATE,
        status: USER_STATUSES.ACTIVE
    },
    {
        name: 'Priya Candidate',
        email: 'candidate2@resumeai.com',
        password: 'Candidate@123',
        role: ROLES.CANDIDATE,
        status: USER_STATUSES.ACTIVE
    },
    {
        name: 'Riya HR',
        email: 'hr1@resumeai.com',
        password: 'HR@123',
        role: ROLES.HR,
        status: USER_STATUSES.ACTIVE
    },
    {
        name: 'Karan HR',
        email: 'hr2@resumeai.com',
        password: 'HR@123',
        role: ROLES.HR,
        status: USER_STATUSES.ACTIVE
    }
];

const JOB_TEMPLATES = [
    {
        title: 'Frontend Developer',
        description:
            'We are looking for a Frontend Developer with strong experience in React, JavaScript, HTML, CSS, and modern UI development. The candidate should be able to build responsive user interfaces, integrate REST APIs, and collaborate with backend developers. Experience with Tailwind CSS, TypeScript, and component-based architecture is preferred.',
        location: 'Bangalore, India',
        employmentType: 'full-time',
        requiredSkills: ['react', 'javascript', 'html', 'css', 'rest api'],
        niceToHaveSkills: ['tailwind css', 'typescript', 'redux'],
        tags: ['frontend', 'react', 'ui'],
        openings: 2,
        salaryRange: { min: 600000, max: 1200000, currency: 'INR' },
        reviewStages: ['screen', 'technical interview', 'hr interview', 'offer'],
        scoringConfig: {
            weights: {
                skills: 35,
                experience: 25,
                education: 15,
                keywords: 25
            },
            constraints: {
                mustHaveSkills: ['react', 'javascript', 'html', 'css'],
                niceToHaveSkills: ['tailwind css', 'typescript'],
                minYearsExperience: 1
            },
            version: 1
        }
    },
    {
        title: 'Backend Developer',
        description:
            'Seeking a Backend Developer proficient in Node.js, Express.js, MongoDB, and RESTful API development. The candidate should understand authentication, database schema design, and scalable server-side architecture. Familiarity with JWT, Mongoose, and deployment workflows is a plus.',
        location: 'Hyderabad, India',
        employmentType: 'full-time',
        requiredSkills: ['node.js', 'express.js', 'mongodb', 'rest api'],
        niceToHaveSkills: ['jwt', 'mongoose', 'docker'],
        tags: ['backend', 'node', 'api'],
        openings: 2,
        salaryRange: { min: 700000, max: 1400000, currency: 'INR' },
        reviewStages: ['screen', 'technical interview', 'system design', 'offer'],
        scoringConfig: {
            weights: {
                skills: 35,
                experience: 30,
                education: 10,
                keywords: 25
            },
            constraints: {
                mustHaveSkills: ['node.js', 'express.js', 'mongodb'],
                niceToHaveSkills: ['jwt', 'mongoose'],
                minYearsExperience: 2
            },
            version: 1
        }
    },
    {
        title: 'Full Stack Developer',
        description:
            'Looking for a Full Stack Developer who can work across React, Node.js, Express, and MongoDB. The role includes building frontend interfaces, backend APIs, authentication flows, and integrating databases. Candidates with project experience in MERN stack applications are highly preferred.',
        location: 'Pune, India',
        employmentType: 'full-time',
        requiredSkills: ['react', 'node.js', 'express.js', 'mongodb', 'javascript'],
        niceToHaveSkills: ['typescript', 'redux', 'tailwind css'],
        tags: ['full-stack', 'mern', 'web'],
        openings: 3,
        salaryRange: { min: 800000, max: 1500000, currency: 'INR' },
        reviewStages: ['screen', 'technical interview', 'manager round', 'offer'],
        scoringConfig: {
            weights: {
                skills: 40,
                experience: 25,
                education: 10,
                keywords: 25
            },
            constraints: {
                mustHaveSkills: ['react', 'node.js', 'mongodb'],
                niceToHaveSkills: ['tailwind css', 'typescript'],
                minYearsExperience: 2
            },
            version: 1
        }
    },
    {
        title: 'Python Developer',
        description:
            'We need a Python Developer with knowledge of Python, FastAPI, data handling, and API development. Candidates should be comfortable writing clean backend code, handling integrations, and working on automation or AI-based modules. Experience with pandas and ML libraries is beneficial.',
        location: 'Chennai, India',
        employmentType: 'full-time',
        requiredSkills: ['python', 'fastapi', 'api development'],
        niceToHaveSkills: ['pandas', 'machine learning', 'numpy'],
        tags: ['python', 'fastapi', 'backend'],
        openings: 2,
        salaryRange: { min: 650000, max: 1300000, currency: 'INR' },
        reviewStages: ['screen', 'technical interview', 'hr interview', 'offer'],
        scoringConfig: {
            weights: {
                skills: 35,
                experience: 25,
                education: 15,
                keywords: 25
            },
            constraints: {
                mustHaveSkills: ['python', 'fastapi'],
                niceToHaveSkills: ['machine learning', 'pandas'],
                minYearsExperience: 1
            },
            version: 1
        }
    },
    {
        title: 'Data Analyst',
        description:
            'Hiring a Data Analyst with skills in SQL, Excel, Python, dashboards, and data visualization. The role involves analyzing datasets, generating reports, and supporting decision-making with insights. Experience with Power BI, Tableau, and statistical analysis is preferred.',
        location: 'Mumbai, India',
        employmentType: 'full-time',
        requiredSkills: ['sql', 'excel', 'python', 'data analysis'],
        niceToHaveSkills: ['power bi', 'tableau', 'statistics'],
        tags: ['data', 'analytics', 'reporting'],
        openings: 1,
        salaryRange: { min: 550000, max: 1100000, currency: 'INR' },
        reviewStages: ['screen', 'assessment', 'interview', 'offer'],
        scoringConfig: {
            weights: {
                skills: 35,
                experience: 20,
                education: 20,
                keywords: 25
            },
            constraints: {
                mustHaveSkills: ['sql', 'excel', 'python'],
                niceToHaveSkills: ['power bi', 'tableau'],
                minYearsExperience: 1
            },
            version: 1
        }
    },
    {
        title: 'AI/ML Engineer',
        description:
            'We are seeking an AI/ML Engineer with experience in Python, machine learning, NLP, data preprocessing, and model evaluation. The candidate should be able to work with embeddings, recommendation systems, and intelligent matching solutions. Familiarity with scikit-learn, transformers, and deep learning is a plus.',
        location: 'Remote',
        employmentType: 'full-time',
        requiredSkills: ['python', 'machine learning', 'nlp', 'data preprocessing'],
        niceToHaveSkills: ['scikit-learn', 'transformers', 'deep learning'],
        tags: ['ai', 'ml', 'nlp'],
        openings: 1,
        salaryRange: { min: 900000, max: 1800000, currency: 'INR' },
        reviewStages: ['screen', 'technical interview', 'problem solving', 'offer'],
        scoringConfig: {
            weights: {
                skills: 40,
                experience: 25,
                education: 10,
                keywords: 25
            },
            constraints: {
                mustHaveSkills: ['python', 'machine learning', 'nlp'],
                niceToHaveSkills: ['transformers', 'deep learning'],
                minYearsExperience: 2
            },
            version: 1
        }
    }
];

const seedUsers = async () => {
    const createdUsers = {};

    for (const user of USERS) {
        const existing = await User.findOne({ email: user.email.toLowerCase() });

        if (existing) {
            createdUsers[user.email] = existing;
            continue;
        }

        const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

        const newUser = await User.create({
            name: user.name,
            email: user.email.toLowerCase(),
            passwordHash,
            role: user.role,
            status: user.status
        });

        createdUsers[user.email] = newUser;
    }

    return createdUsers;
};

const seedJobs = async (hr1Id, hr2Id) => {
    await JobDescription.deleteMany({
        title: { $in: JOB_TEMPLATES.map((job) => job.title) }
    });

    const jobsForHr1 = JOB_TEMPLATES.slice(0, 3).map((job) => ({
        ...job,
        hrId: hr1Id,
        status: 'open',
        embeddings: [],
        metadata: {
            department: 'Engineering',
            seeded: 'true'
        },
        scoringConfigVersion: 1
    }));

    const jobsForHr2 = JOB_TEMPLATES.slice(3, 6).map((job) => ({
        ...job,
        hrId: hr2Id,
        status: 'open',
        embeddings: [],
        metadata: {
            department: job.title.includes('Data') || job.title.includes('AI') ? 'Data & AI' : 'Engineering',
            seeded: 'true'
        },
        scoringConfigVersion: 1
    }));

    const allJobs = [...jobsForHr1, ...jobsForHr2];
    await JobDescription.insertMany(allJobs);

    return allJobs;
};

const runSeed = async () => {
    try {
        await connectDB();

        console.log('🌱 Seeding users...');
        const users = await seedUsers();

        const hr1 = users['hr1@resumeai.com'];
        const hr2 = users['hr2@resumeai.com'];

        if (!hr1 || !hr2) {
            throw new Error('HR users were not created correctly.');
        }

        console.log('🌱 Seeding job descriptions...');
        const jobs = await seedJobs(hr1._id, hr2._id);

        console.log('\n✅ Seed completed successfully.\n');

        console.log('Created / available users:');
        USERS.forEach((user) => {
            console.log(
                `- ${user.role.toUpperCase()} | ${user.email} | password: ${user.password}`
            );
        });

        console.log('\nJob assignments:');
        console.log(`- ${hr1.name} (${hr1.email}) -> 3 jobs`);
        console.log(`- ${hr2.name} (${hr2.email}) -> 3 jobs`);

        jobs.forEach((job, index) => {
            const assignedHr = index < 3 ? hr1.email : hr2.email;
            console.log(`  • ${job.title} -> ${assignedHr}`);
        });
    } catch (error) {
        console.error('❌ Seed failed:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 MongoDB connection closed');
    }
};

runSeed();
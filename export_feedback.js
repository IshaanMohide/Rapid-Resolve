import { getDB, syncFeedbackToCSV, CSV_PATH, getAllFeedback } from './db.js';

console.log('====================================================');
console.log('📊 Rapid Resolve — Customer Feedback Excel/CSV Export');
console.log('====================================================');

// Ensure database is initialized
getDB();

const filePath = syncFeedbackToCSV();
const feedback = getAllFeedback();

console.log(`✅ Success! Exported ${feedback.length} feedback record(s).`);
console.log(`📁 File Location: ${filePath}`);
console.log('\nYou can open this file directly in Microsoft Excel, Google Sheets, or any text editor.');

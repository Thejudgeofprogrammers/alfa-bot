export interface QuizAnswer {
  [key: string]: string;
}

export interface QuizQuestion {
  id: string;
  name: string;
  description: string;
  answers: QuizAnswer;
  correct: string;
}

export interface Quiz {
  id: string;
  name: string;
  description: string;
  questions: QuizQuestion[];
}

export interface QuizData {
  quizzes: Quiz[];
}

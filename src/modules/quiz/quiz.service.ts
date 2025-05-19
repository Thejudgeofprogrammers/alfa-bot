import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { QuizQuestion, Quiz, QuizData } from './dto/index.dto';

@Injectable()
export class QuizService {
  private quizData: QuizData;

  constructor() {
    const path = resolve(__dirname, '../../../jsons/quiz.json');
    this.quizData = JSON.parse(readFileSync(path, 'utf-8'));
  }

  getAllQuizzes(): Quiz[] {
    return this.quizData.quizzes;
  }

  getQuizById(quizId: string): Quiz | undefined {
    return this.quizData.quizzes.find((q) => q.id === quizId);
  }

  getQuestion(quizId: string, questionId: string): QuizQuestion | undefined {
    const quiz = this.getQuizById(quizId);
    return quiz?.questions.find((q) => q.id === questionId);
  }

  checkAnswer(quizId: string, questionId: string, userAnswer: string): boolean {
    const question = this.getQuestion(quizId, questionId);
    if (!question) return false;
    return question.correct === userAnswer;
  }
}

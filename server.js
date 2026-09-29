
import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// =====================================
// 1. ОСНОВНОЙ AI-ЧАТ
// =====================================

app.post("/webhook", async (req, res) => {
  try {
    const question =
      req.body.queryResult?.queryText || "Привет";

    console.log("ВОПРОС ПОЛУЧЕН:", question);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: question,
      config: {
        systemInstruction:
          "Ты дружелюбный ИИ-помощник для студентов. Отвечай на русском языке понятно и кратко. Всегда отвечай непосредственно на заданный вопрос, не приветствуй пользователя вместо ответа.",
      },
    });

    console.log("ОТВЕТ GEMINI:", response.text);

    res.json({
      fulfillmentText:
        response.text || "Не удалось получить ответ.",
    });

  } catch (error) {
    console.error("ОШИБКА ЧАТА:", error);

    res.status(500).json({
      fulfillmentText: "Произошла ошибка при обращении к AI.",
    });
  }
});

// =====================================
// 2. ГЕНЕРАЦИЯ ТЕСТОВ
// =====================================

app.post("/generate-quiz", async (req, res) => {
  try {
    const { subject, difficulty, count } = req.body;

    const allowedSubjects = [
      "Информатика",
      "Математика",
      "Физика",
      "Английский",
    ];

    const allowedDifficulties = [
      "Лёгкая",
      "Средняя",
      "Сложная",
    ];

    if (!allowedSubjects.includes(subject)) {
      return res.status(400).json({
        error: "Выбран неизвестный предмет.",
      });
    }

    if (!allowedDifficulties.includes(difficulty)) {
      return res.status(400).json({
        error: "Выбрана неизвестная сложность.",
      });
    }

    const questionCount = Math.min(
      Math.max(Number(count) || 5, 5),
      10
    );

    console.log(
      `ГЕНЕРАЦИЯ ТЕСТА: ${subject}, ${difficulty}, ${questionCount} вопросов`
    );

    const prompt = `
Ты профессиональный преподаватель.

Создай учебный тест.

Предмет: ${subject}
Сложность: ${difficulty}
Количество вопросов: ${questionCount}

Требования:
1. Все вопросы должны относиться к выбранному предмету.
2. Каждый вопрос должен иметь ровно 4 варианта ответа.
3. Только один вариант должен быть правильным.
4. Вопросы должны быть понятными и грамотными.
5. Не повторяй вопросы.
6. Добавь объяснение правильного ответа.
7. Для английского используй задания по английскому языку.
8. Не добавляй текст вне JSON.

Верни строго следующую структуру:

{
  "questions": [
    {
      "question": "Текст вопроса",
      "options": [
        "Вариант A",
        "Вариант B",
        "Вариант C",
        "Вариант D"
      ],
      "correctAnswer": 0,
      "explanation": "Объяснение правильного ответа"
    }
  ]
}

correctAnswer — индекс правильного варианта:
0, 1, 2 или 3.

Создай ровно ${questionCount} вопросов.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const quiz = JSON.parse(response.text);

    if (
      !Array.isArray(quiz.questions) ||
      quiz.questions.length !== questionCount
    ) {
      throw new Error("Gemini вернул неправильное количество вопросов.");
    }

    for (const question of quiz.questions) {
      if (
        typeof question.question !== "string" ||
        !Array.isArray(question.options) ||
        question.options.length !== 4 ||
        !Number.isInteger(question.correctAnswer) ||
        question.correctAnswer < 0 ||
        question.correctAnswer > 3 ||
        typeof question.explanation !== "string"
      ) {
        throw new Error("Некорректный формат вопроса.");
      }
    }

    console.log("ТЕСТ УСПЕШНО СОЗДАН");

    res.json(quiz);

  } catch (error) {
    console.error("ОШИБКА ГЕНЕРАЦИИ ТЕСТА:", error);

    res.status(500).json({
      error: "Не удалось создать тест. Попробуй ещё раз.",
    });
  }
});

// =====================================
// 3. ЗАПУСК СЕРВЕРА
// =====================================

app.listen(PORT, () => {
  console.log(`ALT AI запущен: http://localhost:${PORT}`);
});
import type { Schema, Struct } from '@strapi/strapi';

export interface QuizOpcio extends Struct.ComponentSchema {
  collectionName: 'components_quiz_opcio';
  info: {
    displayName: 'Opci\u00F3';
  };
  attributes: {
    esCorrecta: Schema.Attribute.Boolean;
    text: Schema.Attribute.String;
  };
}

export interface QuizPregunta extends Struct.ComponentSchema {
  collectionName: 'components_quiz_preguntas';
  info: {
    displayName: 'Pregunta';
  };
  attributes: {
    explicacio: Schema.Attribute.Blocks;
    opcions: Schema.Attribute.Component<'quiz.opcio', true>;
    text: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'quiz.opcio': QuizOpcio;
      'quiz.pregunta': QuizPregunta;
    }
  }
}

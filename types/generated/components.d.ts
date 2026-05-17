import type { Schema, Struct } from '@strapi/strapi';

export interface MaterialFlashcard extends Struct.ComponentSchema {
  collectionName: 'components_material_flashcards';
  info: {
    displayName: 'Flashcard';
  };
  attributes: {
    pregunta: Schema.Attribute.String;
    resposta: Schema.Attribute.Text;
  };
}

export interface MaterialVideo extends Struct.ComponentSchema {
  collectionName: 'components_material_videos';
  info: {
    displayName: 'Video';
  };
  attributes: {
    fitxer: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    titol: Schema.Attribute.String;
    url: Schema.Attribute.String;
  };
}

export interface QuizOpcio extends Struct.ComponentSchema {
  collectionName: 'components_quiz_opcio';
  info: {
    displayName: 'Opci\u00F3';
  };
  attributes: {
    esCorrecta: Schema.Attribute.Boolean;
    text: Schema.Attribute.Text;
  };
}

export interface QuizPregunta extends Struct.ComponentSchema {
  collectionName: 'components_quiz_preguntas';
  info: {
    displayName: 'Pregunta';
  };
  attributes: {
    es_multiresposta: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    explicacio: Schema.Attribute.Blocks;
    opcions: Schema.Attribute.Component<'quiz.opcio', true>;
    text: Schema.Attribute.Text;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'material.flashcard': MaterialFlashcard;
      'material.video': MaterialVideo;
      'quiz.opcio': QuizOpcio;
      'quiz.pregunta': QuizPregunta;
    }
  }
}

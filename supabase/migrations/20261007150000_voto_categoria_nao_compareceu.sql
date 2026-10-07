-- Nova categoria neutra de voto: "nao_compareceu", para o registro oficial "Não Compareceu"
-- do Senado (código NCom, visto na votação do PLP 74/2026 em 03/09/2026). A Câmara não lista
-- quem não votou, então a categoria só aparece no Senado.
alter table public.voto drop constraint voto_categoria_check;
alter table public.voto add constraint voto_categoria_check check (categoria in (
  'sim', 'nao', 'abstencao', 'obstrucao', 'ausente_justificado', 'licenca',
  'presente_sem_voto', 'nao_compareceu', 'presidente', 'secreto', 'outro'));

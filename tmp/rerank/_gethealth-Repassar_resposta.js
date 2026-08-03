const prep = $('Preparar sucesso').first().json || {};
const audit = $input.first().json || {};
return [{ json: audit.response != null ? audit : prep }];
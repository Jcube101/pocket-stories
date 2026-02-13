(function () {
    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function validateAndNormalizeStory(input) {
        const warnings = [];
        const errors = [];

        if (!isPlainObject(input)) {
            errors.push('Story must be a JSON/YAML object at the top level.');
            return { ok: false, data: null, warnings, errors };
        }

        const normalized = { ...input };

        const rawVariables = input.variables;
        const allowedVariableKeys = ['inventory', 'relationships', 'flags'];
        const normalizedVariables = {
            inventory: {},
            relationships: {},
            flags: {}
        };

        if (rawVariables == null) {
            warnings.push('Missing "variables" object; using empty inventory/relationships/flags.');
        } else if (!isPlainObject(rawVariables)) {
            warnings.push('"variables" must be an object; using empty inventory/relationships/flags.');
        } else {
            allowedVariableKeys.forEach((key) => {
                const value = rawVariables[key];
                if (value == null) return;
                if (isPlainObject(value)) {
                    normalizedVariables[key] = value;
                } else {
                    warnings.push(`variables.${key} must be an object; replacing with {}.`);
                }
            });

            Object.keys(rawVariables).forEach((key) => {
                if (!allowedVariableKeys.includes(key)) {
                    warnings.push(`Dropping unsupported variables bucket "${key}".`);
                }
            });
        }

        normalized.variables = normalizedVariables;

        const rawPassages = input.passages;
        if (!isPlainObject(rawPassages)) {
            errors.push('Story must include a "passages" object map.');
            return { ok: false, data: null, warnings, errors };
        }

        const normalizedPassages = {};

        Object.entries(rawPassages).forEach(([id, passage]) => {
            if (!isPlainObject(passage)) {
                errors.push(`Passage "${id}" must be an object.`);
                return;
            }

            if (typeof passage.text !== 'string') {
                errors.push(`Passage "${id}" is missing a string "text" field.`);
                return;
            }

            const normalizedPassage = {
                ...passage,
                text: passage.text,
                choices: []
            };

            if (passage.choices == null) {
                // optional: normalize to an empty array
            } else if (!Array.isArray(passage.choices)) {
                warnings.push(`Passage "${id}" has non-array "choices"; replacing with [].`);
            } else {
                passage.choices.forEach((choice, index) => {
                    if (!isPlainObject(choice)) {
                        warnings.push(`Dropped non-object choice at ${id}.choices[${index}].`);
                        return;
                    }

                    if (typeof choice.text !== 'string' || typeof choice.target !== 'string') {
                        warnings.push(`Dropped invalid choice at ${id}.choices[${index}] (needs string text + target).`);
                        return;
                    }

                    const normalizedChoice = {
                        text: choice.text,
                        target: choice.target
                    };

                    if (choice.condition != null) {
                        if (typeof choice.condition === 'string') {
                            normalizedChoice.condition = choice.condition;
                        } else {
                            warnings.push(`Choice ${id}.choices[${index}].condition must be a string; removed.`);
                        }
                    }

                    if (choice.effect != null) {
                        if (typeof choice.effect === 'string') {
                            normalizedChoice.effect = choice.effect;
                        } else {
                            warnings.push(`Choice ${id}.choices[${index}].effect must be a string; removed.`);
                        }
                    }

                    normalizedPassage.choices.push(normalizedChoice);
                });
            }

            normalizedPassages[id] = normalizedPassage;
        });

        if (Object.keys(normalizedPassages).length === 0) {
            errors.push('Story has no valid passages after validation.');
        }

        normalized.passages = normalizedPassages;

        return {
            ok: errors.length === 0,
            data: errors.length === 0 ? normalized : null,
            warnings,
            errors
        };
    }

    window.validateAndNormalizeStory = validateAndNormalizeStory;
})();

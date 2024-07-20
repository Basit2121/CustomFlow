function runActions() {
    eel.move_file_from_downloads()();
    eel.run_actions()();
}

$(document).ready(function() {
    let stepCount = 0;
    let detectObjectSteps = [];
    let recordedClickX, recordedClickY;

    // Add CSS styles
    $("<style>")
        .prop("type", "text/css")
        .html(`
            .step {
                background-color: #f0f0f0;
                border: 1px solid #ddd;
                border-radius: 5px;
                padding: 10px;
                margin-bottom: 10px;
            }
            .stepSelect {
                width: 150px;
                padding: 5px;
                margin-right: 10px;
            }
            .additional-input input[type="number"],
            .additional-input input[type="text"] {
                width: 100px;
                padding: 5px;
                margin-right: 5px;
            }
            .remove-step {
                color: red;
                cursor: pointer;
                float: right;
            }
            .detect-object-btn,
            .record-click-btn {
                background-color: #4CAF50;
                color: white;
                padding: 5px 10px;
                border: none;
                border-radius: 3px;
                cursor: pointer;
            }
            .detected-filename {
                margin-left: 10px;
                font-style: italic;
            }
        `)
        .appendTo("head");

    $("#addStep").click(function() {
        stepCount++;
        const newStep = `
            <div class="step" id="step${stepCount}">
                <label for="select${stepCount}">Step ${stepCount}:</label>
                <select class="stepSelect" id="select${stepCount}" name="step${stepCount}">
                    <option value="">Select an option</option>
                    <option value="delay">Delay</option>
                    <option value="hotkeys">Hotkeys</option>
                    <option value="keystrokes">Keystrokes</option>
                    <option value="leftClick">Left Click</option>
                    <option value="rightClick">Right Click</option>
                    <option value="detectObject">Detect Object</option>
                    <option value="recordClick">Record Click Position</option>
                    <option value="loop">Loop</option>
                </select>
                <span class="additional-input"></span>
                <span class="remove-step">x</span>
            </div>
        `;
        $("#stepsContainer").append(newStep);
        updateLoopOptions();
    });

    $(document).on('change', '.stepSelect', function() {
        const stepDiv = $(this).closest('.step');
        const additionalInput = stepDiv.find('.additional-input');
        const selectedOption = $(this).val();
        const stepId = stepDiv.attr('id');

        additionalInput.empty();

        if (selectedOption === 'detectObject' && !detectObjectSteps.includes(stepId)) {
            detectObjectSteps.push(stepId);
        } else if (selectedOption !== 'detectObject' && detectObjectSteps.includes(stepId)) {
            detectObjectSteps = detectObjectSteps.filter(step => step !== stepId);
        }

        switch(selectedOption) {
            case 'delay':
                additionalInput.html('<input type="number" min="0" step="0.1" placeholder="Enter delay in seconds">');
                break;
            case 'hotkeys':
            case 'keystrokes':
                additionalInput.html('<input type="text" placeholder="Enter keys">');
                break;
            case 'detectObject':
                additionalInput.html('<button class="detect-object-btn">Detect Object</button><span class="detected-filename"></span>');
                break;
            case 'leftClick':
            case 'rightClick':
                additionalInput.html('X: <input type="number" class="coord-x"> Y: <input type="number" class="coord-y">  <br><br>Object: <input type="text" class="object-name">');
                break;
            case 'recordClick':
                additionalInput.html('<button class="record-click-btn">Record</button>');
                break;
            case 'loop':
                additionalInput.html('Loop to step: <select class="loop-to-step"></select> <br><br>Number of times: <input type="number" class="loop-count" min="1" value="1">');
                updateLoopOptions();
                break;
        }
    });

    function updateLoopOptions() {
        $('.loop-to-step').each(function() {
            const currentStepId = $(this).closest('.step').attr('id');
            const currentStepNumber = parseInt(currentStepId.replace('step', ''));
            $(this).empty();
            $('.step').each(function() {
                const stepId = $(this).attr('id');
                const stepNumber = parseInt(stepId.replace('step', ''));
                if (stepNumber > currentStepNumber) {
                    $('.loop-to-step').append(`<option value="${stepId}">Step ${stepNumber}</option>`);
                }
            });
        });
    }

    $(document).on('click', '.detect-object-btn', function() {
        eel.start_listener()();
    });

    $(document).on('click', '.record-click-btn', function() {
        eel.startClickTracking()();
    });

    $(document).on('click', '.remove-step', function() {
        const stepDiv = $(this).closest('.step');
        const stepId = stepDiv.attr('id');

        stepDiv.remove();
        detectObjectSteps = detectObjectSteps.filter(step => step !== stepId);
        updateLoopOptions();
    });

    $("#runSteps").click(function() {
        const steps = processStepsWithLoops();
        const stepsJson = JSON.stringify(steps, null, 2);
        downloadJson(stepsJson, 'steps.json');
    });

    function processStepsWithLoops() {
        const processedSteps = [];
        const stepElements = $(".step");

        for (let i = 0; i < stepElements.length; i++) {
            const stepElement = $(stepElements[i]);
            const stepSelect = stepElement.find('.stepSelect').val();

            if (stepSelect === 'loop') {
                const loopToStep = stepElement.find('.loop-to-step').val();
                const loopCount = parseInt(stepElement.find('.loop-count').val()) || 1;
                const loopEndIndex = stepElements.index($(`#${loopToStep}`));

                const stepsToRepeat = [];
                for (let k = i + 1; k <= loopEndIndex; k++) {
                    stepsToRepeat.push(createStepObject($(stepElements[k])));
                }

                for (let j = 0; j < loopCount; j++) {
                    processedSteps.push(...stepsToRepeat);
                }

                i = loopEndIndex; // Skip the steps that were just repeated
            } else {
                processedSteps.push(createStepObject(stepElement));
            }
        }

        return processedSteps;
    }

    function createStepObject(stepElement) {
        const step = {};
        const stepSelect = stepElement.find('.stepSelect').val();
        step.type = stepSelect;

        switch(stepSelect) {
            case 'delay':
                step.value = stepElement.find('input[type="number"]').val();
                break;
            case 'hotkeys':
            case 'keystrokes':
                step.value = stepElement.find('input[type="text"]').val();
                break;
            case 'leftClick':
            case 'rightClick':
                step.value = {
                    x: stepElement.find('.coord-x').val(),
                    y: stepElement.find('.coord-y').val(),
                    object: stepElement.find('.object-name').val()
                };
                break;
            case 'detectObject':
                step.value = 'Trigger object detection';
                break;
            case 'recordClick':
                step.value = {
                    type: 'recordedPosition',
                    x: recordedClickX,
                    y: recordedClickY
                };
                break;
        }

        return step;
    }

    function downloadJson(content, fileName) {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    }

    eel.expose(showClickLocation);
    function showClickLocation(x, y) {
        recordedClickX = x;
        recordedClickY = y;
        $(".record-click-btn").text(`Recorded: (${x}, ${y})`);
    }

    eel.expose(show_detected_filename);
    function show_detected_filename(fileName) {
        $(".detected-filename").last().text(`Object : ${fileName}`);
    }
});
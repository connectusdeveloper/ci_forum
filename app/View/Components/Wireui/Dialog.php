<?php

namespace App\View\Components\Wireui;

use WireUi\Actions;

class Dialog extends Modal
{
    public ?string $description;
    public string $dialog;
    public ?string $title;

    public function __construct(
        ?string $zIndex = null,
        ?string $maxWidth = null,
        ?string $spacing = null,
        ?string $align = null,
        ?string $id = null,
        ?string $title = null,
        ?string $description = null,
        ?string $blur = null
    ) {
        parent::__construct('', $zIndex, $maxWidth, $spacing, $align, $blur);

        $this->title = $title;
        $this->dialog = Actions\Dialog::makeEventName($id);
        $this->description = $description;
    }

    public function render()
    {
        return view('wireui::components.dialog');
    }
}

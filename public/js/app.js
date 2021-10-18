/* global jQuery */
!(function (window, $, undefined) { // eslint-disable-line
  var cheatsheetShown = false

  var $toolbar

  var proxyPath

  var Jingo = {

    init: function (setProxyPath) {
      proxyPath = setProxyPath

      var navh = $('.navbar').height()
      var $tools = $('.tools')
      var qs
      var hl = null

      if (window.location.search !== '') {
        $('input[name=term]').focus()
        qs = $.map(window.location.search.substr(1).split('&'), function (kv) {
          kv = kv.split('=')
          return { k: kv[0], v: decodeURIComponent(kv[1]) }
        })
        $.each(qs, function (i, t) {
          if (t.k === 'hl') {
            hl = t.v
          }
        })
        if (hl) {
          if (window.find && window.getSelection) {
            document.designMode = 'on'
            var sel = window.getSelection()
            sel.collapse(document.body, 0)
            while (window.find(hl)) {
              document.execCommand('HiliteColor', false, 'yellow')
              sel.collapseToEnd()
            }
            sel.collapse(document.body, 0)
            window.find(hl)
            sel.collapseToEnd()
            document.designMode = 'off'
          } else {
            if (document.body.createTextRange) {
              var textRange = document.body.createTextRange()
              while (textRange.findText(hl)) {
                textRange.execCommand('BackColor', false, 'yellow')
                textRange.collapse(false)
              }
            }
          }
        }
      }

      $('#js--login').attr('href', function () {
        return $(this).attr('href').replace('destination', 'destination=' + encodeURIComponent(window.location.pathname))
      })

      if ($('.tools > ul > li').length > 0) {
        var $pah = $('<li class="tools-handle">Tools</li>')
        var pahTo
        var bodyPadding = $('body').css('padding-top')
        $pah.on('mouseover', function () {
          $tools.animate({'margin-top': bodyPadding === '40px' ? '0' : '-20'})
          $pah.slideUp()
        })
        $tools.on('mouseenter', function () {
          clearTimeout(pahTo)
        }).on('mouseleave', function () {
          pahTo = setTimeout(function () {
            $tools.animate({'margin-top': '-62'})
            $pah.slideDown()
          }, 500)
        })
        $('.tools > ul').append($pah)
      }

      $('.confirm-delete-page').on('click', function (evt) {
        return window.confirm('Do you really want to delete this page?')
      })

      $('.confirm-revert').on('click', function (evt) {
        return window.confirm('Do you really want to revert to this revision?')
      })

      var $hCol1 = $('.history td:first-child')

      if ($('js--content').hasClass('edit')) {
        $('#js--editor').focus()
      } else {
        $('#js--pageTitle').focus()
      }

      $('#js--rev-compare').attr('disabled', true)

      toggleCompareCheckboxes()
      $hCol1.find('input').on('click', function () {
        toggleCompareCheckboxes()
      })

      $('#js--rev-compare').on('click', function () {
        if ($hCol1.find(':checked').length < 2) {
          return false
        }
        window.location.href = proxyPath + '/wiki/' + $(this).data('pagename') + '/compare/' + $hCol1.find(':checked').map(function () { return $(this).val() }).toArray().reverse().join('..')
        return false
      })

      if (/^\/pages\/.*\/edit/.test(window.location.pathname) ||
          /^\/pages\/new/.test(window.location.pathname)) {
        $('#js--editor').closest('form').on('submit', function () {
          if (Jingo.cmInstance) {
            Jingo.cmInstance.save()
          }
          window.sessionStorage.setItem('jingo-page', $('#js--editor').val())
        })
        if (window.location.search === '?e=1') {
          // Edit page in error: restore the body
          var content = window.sessionStorage.getItem('jingo-page')
          if (content) {
            $('#js--editor').val(content)
          }
        } else {
          window.sessionStorage.removeItem('jingo-page')
        }
      }

      if (/^\/wiki\//.test(window.location.pathname)) {
        markMissingPagesAsAbsent('#js--content')
      }

      function toggleCompareCheckboxes () {
        $('#js--rev-compare').attr('disabled', true)

        if ($hCol1.find(':checkbox').length === 1) {
          $hCol1.find(':checkbox').hide()
          return
        }
        if ($hCol1.find(':checked').length === 2) {
          $('#js--rev-compare').attr('disabled', false)
          $hCol1.find(':not(:checked)')
                .hide()
          $hCol1.parent('tr')
                .css({'color': 'silver'})
          $hCol1.find(':checked')
                .parents('tr')
                .css({'color': 'black'})
        } else {
          $hCol1.find('input')
                .show()
                .parents('tr')
                .css({'color': 'black'})
        }
      }
    },

    preview: function () {
      $.post(proxyPath + '/misc/preview', {data: $('#js--editor').val()}, function (data) {
        $('#js--preview').html(data).get(0).scrollTop = 0
        markMissingPagesAsAbsent('#js--preview')
        $('#js--content.edit').addClass('preview');
        $('.toolbar li').removeClass('active')
        $('.toolbar .preview').addClass('active');
      })
    },

    edit: function () {
      $('#js--content.edit').removeClass('preview');
        $('.toolbar li').removeClass('active')
        $('.toolbar .edit').addClass('active');
    },

    save: function () {
      $('form.edit').submit()
    },

    upload: function() {
      $("#upload").modal({keyboard: true, show: true, backdrop: false});
      $.get("/misc/upload", function(data) {
        $("#upload .modal-body").html(data).get(0).scrollTop = 0;
      });
    },

    toggleFullscreen: function () {
      var isFullscreen = Jingo.cmInstance.getOption('fullScreen')

      Jingo.cmInstance.setOption('fullScreen', !Jingo.cmInstance.getOption('fullScreen'))
      Jingo.cmInstance.focus()

      $toolbar.toggleClass('fullscreen', !isFullscreen)
    },

    toolbar: function () {
      $('ul.toolbar').on('click', 'li', function () {
        if (this.classList.contains('info')) {
          Jingo.markdownSyntax()
        }
        if (this.classList.contains('edit')) {
          Jingo.edit();
        }
        if (this.classList.contains('preview')) {
          Jingo.cmInstance.save()
          Jingo.preview()
        }
        if (this.classList.contains('fullscreen')) {
          Jingo.toggleFullscreen()
        }
        if (this.classList.contains('upload')) {
          Jingo.upload();
        }
      })
    },

    markdownSyntax: function () {
      $('#js--syntax-reference').modal({keyboard: true, show: true, backdrop: false})
      if (!cheatsheetShown) {
        $('#js--syntax-reference .modal-body').load(proxyPath + '/misc/syntax-reference')
        cheatsheetShown = true
      }
    }
  }

  function markMissingPagesAsAbsent (selector) {
    var pages = []
    var match
    var href

    $(selector + ' a.internal').each(function (i, a) {
      href = $(a).attr('href')
      href = href.slice(proxyPath.length)
      match = /\/wiki\/(.+)/.exec(href)
      if (match) {
        pages.push(decodeURIComponent(match[1]))
      }
    })

    $.getJSON(proxyPath + '/misc/existence', {data: pages}, function (result) {
      $.each(result.data, function (href, a) {
        $(selector + " a[href='" + proxyPath.split('/').join('\\/') + '\\/wiki\\/' + encodeURIComponent(a) + "']").addClass('absent')
      })
    })
  }

  window.Jingo = Jingo
}(this, jQuery))
